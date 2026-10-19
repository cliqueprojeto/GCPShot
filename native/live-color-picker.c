#include <gtk/gtk.h>
#include <gdk/gdkx.h>
#include <signal.h>
#include <errno.h>
#include <stdio.h>
#include <unistd.h>

static GtkWidget *panel;
static GdkPixbuf *pixels;
static int red, green, blue, parent_pid, center_x = 13, center_y = 6;
static gboolean finishing = FALSE;

static void finish(gboolean selected) {
    if (finishing) return;
    finishing = TRUE;
    if (selected) printf("#%02X%02X%02X\n", red, green, blue);
    else puts("CANCEL");
    fflush(stdout);
    gtk_main_quit();
}

static gboolean render(gpointer unused) {
    (void)unused;
    if (parent_pid > 0 && kill(parent_pid, 0) == -1 && errno == ESRCH) { finish(FALSE); return G_SOURCE_REMOVE; }
    GdkDisplay *display = gdk_display_get_default();
    GdkDevice *pointer = gdk_seat_get_pointer(gdk_display_get_default_seat(display));
    int x, y;
    gdk_device_get_position(pointer, NULL, &x, &y);
    GdkRectangle area;
    gdk_monitor_get_workarea(gdk_display_get_monitor_at_point(display, x, y), &area);
    int left = x + 24, top = y + 24;
    if (left + 267 > area.x + area.width) left = x - 291;
    if (top + 198 > area.y + area.height) top = y - 222;
    gtk_window_move(GTK_WINDOW(panel), MAX(area.x, MIN(left, area.x + area.width - 267)), MAX(area.y, MIN(top, area.y + area.height - 198)));
    gdk_display_sync(display);
    GdkWindow *root = gdk_get_default_root_window();
    int sx = MAX(0, MIN(x - 13, gdk_window_get_width(root) - 27));
    int sy = MAX(0, MIN(y - 6, gdk_window_get_height(root) - 13));
    center_x = x - sx; center_y = y - sy;
    GdkPixbuf *next = gdk_pixbuf_get_from_window(root, sx, sy, 27, 13);
    if (!next) return G_SOURCE_CONTINUE;
    if (pixels) g_object_unref(pixels);
    pixels = next;
    guchar *color = gdk_pixbuf_get_pixels(pixels) + (y - sy) * gdk_pixbuf_get_rowstride(pixels) + (x - sx) * gdk_pixbuf_get_n_channels(pixels);
    red = color[0]; green = color[1]; blue = color[2];
    gtk_widget_queue_draw(panel);
    return G_SOURCE_CONTINUE;
}

static gboolean draw(GtkWidget *widget, cairo_t *cr, gpointer unused) {
    (void)widget; (void)unused;
    cairo_set_source_rgb(cr, 0.067, 0.082, 0.118); cairo_paint(cr);
    if (pixels) {
        cairo_save(cr); cairo_translate(cr, 12, 12); cairo_scale(cr, 9, 9);
        gdk_cairo_set_source_pixbuf(cr, pixels, 0, 0);
        cairo_pattern_set_filter(cairo_get_source(cr), CAIRO_FILTER_NEAREST);
        cairo_rectangle(cr, 0, 0, 27, 13); cairo_fill(cr); cairo_restore(cr);
    }
    cairo_set_source_rgb(cr, 0.61, 0.63, 1); cairo_set_line_width(cr, 1);
    cairo_rectangle(cr, 0.5, 0.5, 266, 197); cairo_stroke(cr);
    cairo_rectangle(cr, 12.5 + center_x * 9, 12.5 + center_y * 9, 8, 8); cairo_stroke(cr);
    cairo_select_font_face(cr, "sans", CAIRO_FONT_SLANT_NORMAL, CAIRO_FONT_WEIGHT_NORMAL); cairo_set_font_size(cr, 11);
    char value[80]; snprintf(value, sizeof(value), "#%02X%02X%02X   rgb(%d, %d, %d)", red, green, blue, red, green, blue);
    cairo_set_source_rgb(cr, 1, 1, 1); cairo_move_to(cr, 11, 147); cairo_show_text(cr, value);
    cairo_set_source_rgb(cr, 0.64, 0.71, 0.89); cairo_move_to(cr, 11, 168); cairo_show_text(cr, "GCPShot - Clique para copiar");
    cairo_move_to(cr, 11, 187); cairo_show_text(cr, "Esc cancela - Amostragem em tempo real");
    return TRUE;
}

static gboolean button(GtkWidget *widget, GdkEventButton *event, gpointer unused) {
    (void)widget; (void)unused;
    if (event->button == 1) { render(NULL); finish(TRUE); }
    return TRUE;
}

static gboolean key(GtkWidget *widget, GdkEventKey *event, gpointer unused) {
    (void)widget; (void)unused;
    if (event->keyval == GDK_KEY_Escape) finish(FALSE);
    return TRUE;
}

static void portal_response(GDBusConnection *connection, const gchar *sender, const gchar *path, const gchar *iface, const gchar *signal, GVariant *parameters, gpointer user_data) {
    (void)connection; (void)sender; (void)iface; (void)signal;
    if (g_strcmp0(path, (char *)user_data)) return;
    guint response; GVariant *result;
    g_variant_get(parameters, "(u@a{sv})", &response, &result);
    GVariant *value = g_variant_lookup_value(result, "color", G_VARIANT_TYPE("(ddd)"));
    if (response == 0 && value) {
        double r, g, b; g_variant_get(value, "(ddd)", &r, &g, &b);
        red = (int)(r * 255 + 0.5); green = (int)(g * 255 + 0.5); blue = (int)(b * 255 + 0.5);
        finish(TRUE);
    } else finish(FALSE);
    if (value) g_variant_unref(value);
    g_variant_unref(result);
}

static int portal_pick(void) {
    GError *error = NULL;
    GDBusConnection *bus = g_bus_get_sync(G_BUS_TYPE_SESSION, NULL, &error);
    if (!bus) { fprintf(stderr, "%s\n", error->message); g_error_free(error); return 1; }
    char *sender = g_strdup(g_dbus_connection_get_unique_name(bus) + 1);
    for (char *p = sender; *p; p++) if (*p == '.') *p = '_';
    char *token = g_strdup_printf("gcpshot_%d", getpid());
    char *request = g_strdup_printf("/org/freedesktop/portal/desktop/request/%s/%s", sender, token);
    guint subscription = g_dbus_connection_signal_subscribe(bus, "org.freedesktop.portal.Desktop", "org.freedesktop.portal.Request", "Response", request, NULL, G_DBUS_SIGNAL_FLAGS_NONE, portal_response, request, NULL);
    GVariantBuilder options; g_variant_builder_init(&options, G_VARIANT_TYPE_VARDICT);
    g_variant_builder_add(&options, "{sv}", "handle_token", g_variant_new_string(token));
    GVariant *call = g_dbus_connection_call_sync(bus, "org.freedesktop.portal.Desktop", "/org/freedesktop/portal/desktop", "org.freedesktop.portal.Screenshot", "PickColor", g_variant_new("(sa{sv})", "", &options), G_VARIANT_TYPE("(o)"), G_DBUS_CALL_FLAGS_NONE, -1, NULL, &error);
    int status = 0;
    if (!call) { fprintf(stderr, "O seletor de cores do sistema nao esta disponivel: %s\n", error->message); g_error_free(error); status = 1; }
    else { puts("READY"); fflush(stdout); gtk_main(); g_variant_unref(call); }
    g_dbus_connection_signal_unsubscribe(bus, subscription);
    g_free(request); g_free(token); g_free(sender); g_object_unref(bus);
    return status;
}

int main(int argc, char **argv) {
    parent_pid = argc > 1 ? atoi(argv[1]) : 0;
    gtk_init(&argc, &argv);
    if (!GDK_IS_X11_DISPLAY(gdk_display_get_default())) return portal_pick();
    panel = gtk_window_new(GTK_WINDOW_POPUP);
    gtk_window_set_title(GTK_WINDOW(panel), "GCPShot Live Color");
    gtk_window_set_default_size(GTK_WINDOW(panel), 267, 198);
    gtk_window_set_keep_above(GTK_WINDOW(panel), TRUE);
    gtk_widget_add_events(panel, GDK_BUTTON_RELEASE_MASK | GDK_KEY_PRESS_MASK);
    g_signal_connect(panel, "draw", G_CALLBACK(draw), NULL);
    g_signal_connect(panel, "button-release-event", G_CALLBACK(button), NULL);
    g_signal_connect(panel, "key-press-event", G_CALLBACK(key), NULL);
    gtk_widget_show_all(panel);
    GdkDisplay *display = gdk_display_get_default();
    GdkCursor *cursor = gdk_cursor_new_from_name(display, "crosshair");
    GdkGrabStatus grabbed = gdk_seat_grab(gdk_display_get_default_seat(display), gtk_widget_get_window(panel), GDK_SEAT_CAPABILITY_ALL, FALSE, cursor, NULL, NULL, NULL);
    if (cursor) g_object_unref(cursor);
    if (grabbed != GDK_GRAB_SUCCESS) { fprintf(stderr, "Nao foi possivel iniciar o Live Color.\n"); return 1; }
    render(NULL); g_timeout_add(33, render, NULL);
    puts("READY"); fflush(stdout); gtk_main();
    gdk_seat_ungrab(gdk_display_get_default_seat(display));
    if (pixels) g_object_unref(pixels);
    return 0;
}
