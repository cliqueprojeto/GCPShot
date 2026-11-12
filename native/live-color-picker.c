#include <gtk/gtk.h>
#include <gdk/gdkx.h>
#include <gio/gunixfdlist.h>
#include <string.h>
#include <stdlib.h>
#include <signal.h>
#include <errno.h>
#include <stdio.h>
#include <unistd.h>

static GtkWidget *panel;
static GdkPixbuf *pixels;
static int red, green, blue, parent_pid, center_x = 13, center_y = 6;
static gboolean finishing = FALSE;
static int exit_status = 0;
static gint64 grab_deadline;
static gint64 session_deadline;

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
    cairo_set_source_rgb(cr, 0.64, 0.71, 0.89); cairo_move_to(cr, 11, 168); cairo_show_text(cr, "GCPShot - Clique ou Enter para copiar");
    cairo_move_to(cr, 11, 187); cairo_show_text(cr, "Esc cancela - Amostragem em tempo real");
    return TRUE;
}

static gboolean button(GtkWidget *widget, GdkEventButton *event, gpointer unused) {
    (void)widget; (void)unused;
    if (event->button == 1) { render(NULL); finish(pixels != NULL); }
    else if (event->button == 3) finish(FALSE);
    return TRUE;
}

static gboolean key(GtkWidget *widget, GdkEventKey *event, gpointer unused) {
    (void)widget; (void)unused;
    if (event->keyval == GDK_KEY_Escape) finish(FALSE);
    else if (event->keyval == GDK_KEY_Return || event->keyval == GDK_KEY_KP_Enter) finish(pixels != NULL);
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

/* ---- Silent screenshot mode (Wayland): KWin ScreenShot2, then the Screenshot portal without dialogs. ---- */

static GMainLoop *shot_loop;
static char *shot_uri;
static guint shot_response = 2;

static gboolean write_png(const char *path, guchar *data, int width, int height, int stride, guint format) {
    /* QImage formats: 4 RGB32, 5 ARGB32, 6 ARGB32_Premultiplied (BGRA bytes on little endian); 16 RGBX8888, 17 RGBA8888, 18 RGBA8888_Premultiplied. */
    gboolean bgra = format == 4 || format == 5 || format == 6;
    gboolean rgba = format == 16 || format == 17 || format == 18;
    if (!bgra && !rgba) { fprintf(stderr, "Formato de imagem do KWin nao suportado: %u\n", format); return FALSE; }
    guchar *rgb = g_malloc((gsize)width * height * 3);
    for (int y = 0; y < height; y++) {
        const guchar *row = data + (gsize)y * stride;
        guchar *out = rgb + (gsize)y * width * 3;
        for (int x = 0; x < width; x++) {
            const guchar *px = row + x * 4;
            int alpha = (format == 6 || format == 18) ? px[3] : 255;
            int r = bgra ? px[2] : px[0], g = px[1], b = bgra ? px[0] : px[2];
            if (alpha > 0 && alpha < 255) { r = MIN(255, r * 255 / alpha); g = MIN(255, g * 255 / alpha); b = MIN(255, b * 255 / alpha); }
            out[x * 3] = r; out[x * 3 + 1] = g; out[x * 3 + 2] = b;
        }
    }
    GdkPixbuf *image = gdk_pixbuf_new_from_data(rgb, GDK_COLORSPACE_RGB, FALSE, 8, width, height, width * 3, NULL, NULL);
    GError *error = NULL;
    gboolean ok = gdk_pixbuf_save(image, path, "png", &error, "compression", "1", NULL);
    if (!ok) { fprintf(stderr, "%s\n", error->message); g_error_free(error); }
    g_object_unref(image); g_free(rgb);
    return ok;
}

static int kwin_screenshot(GDBusConnection *bus, const char *path) {
    int fds[2];
    if (pipe(fds) != 0) return 1;
    GError *error = NULL;
    GUnixFDList *list = g_unix_fd_list_new();
    int index = g_unix_fd_list_append(list, fds[1], &error);
    close(fds[1]);
    if (index < 0) { close(fds[0]); g_object_unref(list); if (error) g_error_free(error); return 1; }
    GVariantBuilder options; g_variant_builder_init(&options, G_VARIANT_TYPE_VARDICT);
    g_variant_builder_add(&options, "{sv}", "include-cursor", g_variant_new_boolean(FALSE));
    g_variant_builder_add(&options, "{sv}", "native-resolution", g_variant_new_boolean(TRUE));
    GVariant *reply = g_dbus_connection_call_with_unix_fd_list_sync(bus, "org.kde.KWin", "/org/kde/KWin/ScreenShot2", "org.kde.KWin.ScreenShot2", "CaptureActiveScreen",
        g_variant_new("(a{sv}h)", &options, index), G_VARIANT_TYPE("(a{sv})"), G_DBUS_CALL_FLAGS_NONE, 6000, list, NULL, NULL, &error);
    g_object_unref(list);
    if (!reply) { fprintf(stderr, "KWin: %s\n", error->message); g_error_free(error); close(fds[0]); return 1; }
    GVariant *results = g_variant_get_child_value(reply, 0);
    guint width = 0, height = 0, stride = 0, format = 0;
    g_variant_lookup(results, "width", "u", &width);
    g_variant_lookup(results, "height", "u", &height);
    g_variant_lookup(results, "stride", "u", &stride);
    g_variant_lookup(results, "format", "u", &format);
    g_variant_unref(results); g_variant_unref(reply);
    gsize expected = (gsize)stride * height, received = 0;
    if (!width || !height || stride < width * 4 || expected > ((gsize)1 << 31)) { close(fds[0]); fprintf(stderr, "KWin devolveu uma imagem invalida.\n"); return 1; }
    guchar *data = g_malloc(expected);
    while (received < expected) {
        ssize_t count = read(fds[0], data + received, expected - received);
        if (count < 0 && errno == EINTR) continue;
        if (count <= 0) break;
        received += (gsize)count;
    }
    close(fds[0]);
    int status = received == expected && write_png(path, data, (int)width, (int)height, (int)stride, format) ? 0 : 1;
    if (received != expected) fprintf(stderr, "KWin enviou a captura incompleta.\n");
    g_free(data);
    if (status == 0) { printf("OK kwin screen %u %u\n", width, height); fflush(stdout); }
    return status;
}

static void shot_portal_response(GDBusConnection *connection, const gchar *sender, const gchar *path, const gchar *iface, const gchar *signal, GVariant *parameters, gpointer user_data) {
    (void)connection; (void)sender; (void)iface; (void)signal;
    if (g_strcmp0(path, (char *)user_data)) return;
    GVariant *result;
    g_variant_get(parameters, "(u@a{sv})", &shot_response, &result);
    const char *uri = NULL;
    if (shot_response == 0 && g_variant_lookup(result, "uri", "&s", &uri)) shot_uri = g_strdup(uri);
    g_variant_unref(result);
    g_main_loop_quit(shot_loop);
}

static gboolean shot_timeout(gpointer unused) { (void)unused; g_main_loop_quit(shot_loop); return G_SOURCE_REMOVE; }

static int portal_screenshot(GDBusConnection *bus, const char *path) {
    GError *error = NULL;
    char *sender = g_strdup(g_dbus_connection_get_unique_name(bus) + 1);
    for (char *p = sender; *p; p++) if (*p == '.') *p = '_';
    char *token = g_strdup_printf("gcpshot_shot_%d", getpid());
    char *request = g_strdup_printf("/org/freedesktop/portal/desktop/request/%s/%s", sender, token);
    shot_loop = g_main_loop_new(NULL, FALSE);
    guint subscription = g_dbus_connection_signal_subscribe(bus, "org.freedesktop.portal.Desktop", "org.freedesktop.portal.Request", "Response", request, NULL, G_DBUS_SIGNAL_FLAGS_NONE, shot_portal_response, request, NULL);
    GVariantBuilder options; g_variant_builder_init(&options, G_VARIANT_TYPE_VARDICT);
    g_variant_builder_add(&options, "{sv}", "handle_token", g_variant_new_string(token));
    g_variant_builder_add(&options, "{sv}", "interactive", g_variant_new_boolean(FALSE));
    g_variant_builder_add(&options, "{sv}", "modal", g_variant_new_boolean(FALSE));
    GVariant *call = g_dbus_connection_call_sync(bus, "org.freedesktop.portal.Desktop", "/org/freedesktop/portal/desktop", "org.freedesktop.portal.Screenshot", "Screenshot",
        g_variant_new("(sa{sv})", "", &options), G_VARIANT_TYPE("(o)"), G_DBUS_CALL_FLAGS_NONE, 6000, NULL, &error);
    int status = 1;
    if (!call) { fprintf(stderr, "Portal de captura: %s\n", error->message); g_error_free(error); }
    else {
        g_timeout_add_seconds(60, shot_timeout, NULL);
        g_main_loop_run(shot_loop);
        g_variant_unref(call);
        if (shot_uri) {
            GFile *source = g_file_new_for_uri(shot_uri), *target = g_file_new_for_path(path);
            if (g_file_copy(source, target, G_FILE_COPY_OVERWRITE, NULL, NULL, NULL, &error)) {
                g_file_delete(source, NULL, NULL);
                printf("OK portal desktop\n"); fflush(stdout); status = 0;
            } else { fprintf(stderr, "%s\n", error->message); g_error_free(error); }
            g_object_unref(source); g_object_unref(target);
        } else fprintf(stderr, shot_response == 1 ? "Captura negada pelo sistema.\n" : "O portal de captura nao respondeu.\n");
    }
    g_dbus_connection_signal_unsubscribe(bus, subscription);
    g_main_loop_unref(shot_loop);
    g_free(request); g_free(token); g_free(sender); g_free(shot_uri);
    return status;
}

static int silent_screenshot(const char *path, gboolean allow_kwin) {
    GError *error = NULL;
    GDBusConnection *bus = g_bus_get_sync(G_BUS_TYPE_SESSION, NULL, &error);
    if (!bus) { fprintf(stderr, "%s\n", error->message); g_error_free(error); return 1; }
    int status = allow_kwin ? kwin_screenshot(bus, path) : 1;
    if (status != 0) status = portal_screenshot(bus, path);
    g_object_unref(bus);
    return status;
}

static gboolean watch_parent(gpointer unused) {
    (void)unused;
    if ((parent_pid > 0 && kill(parent_pid, 0) == -1 && errno == ESRCH) || g_get_monotonic_time() > session_deadline) {
        finish(FALSE); return G_SOURCE_REMOVE;
    }
    return G_SOURCE_CONTINUE;
}

static gboolean try_grab(gpointer unused) {
    (void)unused;
    GdkDisplay *display = gdk_display_get_default();
    GdkCursor *cursor = gdk_cursor_new_from_name(display, "crosshair");
    GdkGrabStatus grabbed = gdk_seat_grab(gdk_display_get_default_seat(display), gtk_widget_get_window(panel), GDK_SEAT_CAPABILITY_ALL, FALSE, cursor, NULL, NULL, NULL);
    if (cursor) g_object_unref(cursor);
    if (grabbed == GDK_GRAB_SUCCESS) {
        render(NULL); g_timeout_add(33, render, NULL);
        puts("READY"); fflush(stdout);
        return G_SOURCE_REMOVE;
    }
    // A global shortcut or tray menu may still own the keyboard when we start.
    if (g_get_monotonic_time() < grab_deadline) return G_SOURCE_CONTINUE;
    fprintf(stderr, "Nao foi possivel iniciar o Live Color: teclado ou mouse ocupado. Solte as teclas do atalho e tente novamente.\n");
    exit_status = 1;
    finish(FALSE);
    return G_SOURCE_REMOVE;
}

int main(int argc, char **argv) {
    /* --screenshot <file.png> [--no-kwin]: silent capture of the active monitor without opening GTK windows. */
    if (argc > 2 && strcmp(argv[1], "--screenshot") == 0) return silent_screenshot(argv[2], !(argc > 3 && strcmp(argv[3], "--no-kwin") == 0));
    parent_pid = argc > 1 ? atoi(argv[1]) : 0;
    session_deadline = g_get_monotonic_time() + 120 * G_USEC_PER_SEC;
    gtk_init(&argc, &argv);
    g_timeout_add(1000, watch_parent, NULL);
    if (!GDK_IS_X11_DISPLAY(gdk_display_get_default())) return portal_pick();
    panel = gtk_window_new(GTK_WINDOW_POPUP);
    gtk_window_set_title(GTK_WINDOW(panel), "GCPShot Live Color");
    gtk_window_set_skip_taskbar_hint(GTK_WINDOW(panel), TRUE);
    gtk_window_set_skip_pager_hint(GTK_WINDOW(panel), TRUE);
    gtk_window_set_default_size(GTK_WINDOW(panel), 267, 198);
    gtk_window_set_keep_above(GTK_WINDOW(panel), TRUE);
    gtk_widget_add_events(panel, GDK_BUTTON_RELEASE_MASK | GDK_KEY_PRESS_MASK);
    g_signal_connect(panel, "draw", G_CALLBACK(draw), NULL);
    g_signal_connect(panel, "button-release-event", G_CALLBACK(button), NULL);
    g_signal_connect(panel, "key-press-event", G_CALLBACK(key), NULL);
    gtk_widget_show_all(panel);
    grab_deadline = g_get_monotonic_time() + 3 * G_USEC_PER_SEC;
    g_timeout_add(40, try_grab, NULL);
    gtk_main();
    gdk_seat_ungrab(gdk_display_get_default_seat(gdk_display_get_default()));
    if (pixels) g_object_unref(pixels);
    gtk_widget_destroy(panel);
    return exit_status;
}
