#include <X11/Xlib.h>
#include <stdio.h>
#include <unistd.h>

int main(void) {
    Display *display = XOpenDisplay(NULL);
    if (!display) return 1;
    if (XGrabKeyboard(display, DefaultRootWindow(display), False, GrabModeAsync, GrabModeAsync, CurrentTime) != GrabSuccess) return 2;
    XSync(display, False);
    puts("GRABBED"); fflush(stdout);
    usleep(900000);
    XUngrabKeyboard(display, CurrentTime);
    XCloseDisplay(display);
    return 0;
}
