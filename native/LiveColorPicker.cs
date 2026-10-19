using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;

internal static class LiveColorPicker
{
    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] private static extern bool SetProcessDPIAware();

    [STAThread]
    private static void Main(string[] args)
    {
        try
        {
            try { SetProcessDpiAwarenessContext(new IntPtr(-4)); }
            catch (EntryPointNotFoundException) { SetProcessDPIAware(); }
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.ThrowException);
            Application.EnableVisualStyles();
            int parent;
            int.TryParse(args.Length > 0 ? args[0] : "0", out parent);
            Application.Run(new Picker(parent));
        }
        catch (Exception error) { Console.Error.WriteLine(error.Message); Environment.ExitCode = 1; }
    }

    private sealed class Picker : Form
    {
        private const int CardWidth = 267, CardHeight = 198, Zoom = 9;
        private readonly Timer timer = new Timer();
        private readonly Bitmap pixels = new Bitmap(27, 13, PixelFormat.Format32bppArgb);
        private readonly Bitmap frame = new Bitmap(CardWidth, CardHeight, PixelFormat.Format32bppArgb);
        private readonly Font colorFont = new Font("Segoe UI", 11, FontStyle.Regular, GraphicsUnit.Pixel);
        private readonly Font labelFont = new Font("Segoe UI", 11, FontStyle.Regular, GraphicsUnit.Pixel);
        private readonly HookCallback mouseCallback, keyboardCallback;
        private IntPtr mouseHook, keyboardHook;
        private bool done, leftDown;
        private Color sampled;
        private readonly int parentId;
        private int ticks;

        public Picker(int parent)
        {
            parentId = parent;
            Text = "GCPShot Live Color";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            Size = new Size(CardWidth, CardHeight);
            TopMost = true;
            mouseCallback = MouseHook;
            keyboardCallback = KeyboardHook;
            timer.Interval = 33;
            timer.Tick += delegate { RenderFrame(); };
        }

        protected override bool ShowWithoutActivation { get { return true; } }
        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams value = base.CreateParams;
                value.ExStyle |= 0x80000 | 0x80 | 0x08000000 | 0x20;
                return value;
            }
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            SetWindowDisplayAffinity(Handle, 0x11);
            IntPtr module = GetModuleHandle(null);
            mouseHook = SetWindowsHookEx(14, mouseCallback, module, 0);
            keyboardHook = SetWindowsHookEx(13, keyboardCallback, module, 0);
            if (mouseHook == IntPtr.Zero || keyboardHook == IntPtr.Zero)
                throw new InvalidOperationException("Nao foi possivel iniciar os controles do Live Color.");
            RenderFrame();
            timer.Start();
            Console.WriteLine("READY");
            Console.Out.Flush();
        }

        private IntPtr MouseHook(int code, IntPtr message, IntPtr data)
        {
            if (code >= 0 && !done)
            {
                if (message.ToInt32() == 0x201) { leftDown = true; return new IntPtr(1); }
                if (message.ToInt32() == 0x202 && leftDown)
                {
                    RenderFrame();
                    Finish(true);
                    return new IntPtr(1);
                }
            }
            return CallNextHookEx(mouseHook, code, message, data);
        }

        private IntPtr KeyboardHook(int code, IntPtr message, IntPtr data)
        {
            if (code >= 0 && !done && (message.ToInt32() == 0x100 || message.ToInt32() == 0x104) && Marshal.ReadInt32(data) == 27)
            {
                Finish(false);
                return new IntPtr(1);
            }
            return CallNextHookEx(keyboardHook, code, message, data);
        }

        private void Finish(bool selected)
        {
            if (done) return;
            done = true;
            timer.Stop();
            Console.WriteLine(selected ? String.Format("#{0:X2}{1:X2}{2:X2}", sampled.R, sampled.G, sampled.B) : "CANCEL");
            Console.Out.Flush();
            BeginInvoke(new Action(Close));
        }

        private void RenderFrame()
        {
            if (done) return;
            try
            {
                if (++ticks % 30 == 0 && parentId > 0)
                {
                    try { using (Process parent = Process.GetProcessById(parentId)) { if (parent.HasExited) { Finish(false); return; } } }
                    catch (ArgumentException) { Finish(false); return; }
                }
                POINT cursor;
                if (!GetCursorPos(out cursor)) return;
                Rectangle area = Screen.FromPoint(new Point(cursor.X, cursor.Y)).WorkingArea;
                int x = cursor.X + 24, y = cursor.Y + 24;
                if (x + CardWidth > area.Right) x = cursor.X - CardWidth - 24;
                if (y + CardHeight > area.Bottom) y = cursor.Y - CardHeight - 24;
                x = Math.Max(area.Left, Math.Min(x, area.Right - CardWidth));
                y = Math.Max(area.Top, Math.Min(y, area.Bottom - CardHeight));

                // Capture only the small source region and present the completed panel atomically.
                using (Graphics source = Graphics.FromImage(pixels))
                {
                    source.Clear(Color.Black);
                    Rectangle desktop = SystemInformation.VirtualScreen;
                    Rectangle desired = new Rectangle(cursor.X - 13, cursor.Y - 6, 27, 13);
                    Rectangle clipped = Rectangle.Intersect(desktop, desired);
                    if (clipped.Width > 0 && clipped.Height > 0)
                        source.CopyFromScreen(clipped.Location, new Point(clipped.X - desired.X, clipped.Y - desired.Y), clipped.Size, CopyPixelOperation.SourceCopy);
                }
                sampled = pixels.GetPixel(13, 6);
                using (Graphics g = Graphics.FromImage(frame))
                {
                    g.Clear(Color.FromArgb(255, 17, 21, 30));
                    g.InterpolationMode = InterpolationMode.NearestNeighbor;
                    g.PixelOffsetMode = PixelOffsetMode.Half;
                    g.DrawImage(pixels, new Rectangle(12, 12, 243, 117), 0, 0, 27, 13, GraphicsUnit.Pixel);
                    using (Pen border = new Pen(Color.FromArgb(156, 161, 255)))
                    {
                        g.DrawRectangle(border, 0, 0, CardWidth - 1, CardHeight - 1);
                        g.DrawRectangle(border, 12 + 13 * Zoom, 12 + 6 * Zoom, Zoom - 1, Zoom - 1);
                    }
                    string hex = String.Format("#{0:X2}{1:X2}{2:X2}", sampled.R, sampled.G, sampled.B);
                    g.DrawString(String.Format("{0}   rgb({1}, {2}, {3})", hex, sampled.R, sampled.G, sampled.B), colorFont, Brushes.White, 11, 137);
                    using (Brush muted = new SolidBrush(Color.FromArgb(162, 180, 226)))
                    {
                        g.DrawString("GCPShot - Clique para copiar", labelFont, muted, 11, 158);
                        g.DrawString("Esc cancela - Amostragem em tempo real", labelFont, muted, 11, 177);
                    }
                }
#if PICKER_PREVIEW
                if (ticks == 5) frame.Save(System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "../release/live-color-picker-preview.png"));
#endif
                Present(x, y);
            }
            catch (Exception error)
            {
                Console.Error.WriteLine(error.Message);
                Environment.ExitCode = 1;
                Finish(false);
            }
        }

        private void Present(int x, int y)
        {
            IntPtr desktop = GetDC(IntPtr.Zero);
            IntPtr memory = CreateCompatibleDC(desktop);
            IntPtr bitmap = frame.GetHbitmap(Color.FromArgb(0));
            IntPtr previous = SelectObject(memory, bitmap);
            try
            {
                POINT destination = new POINT { X = x, Y = y }, origin = new POINT();
                SIZE size = new SIZE { Width = CardWidth, Height = CardHeight };
                BLENDFUNCTION blend = new BLENDFUNCTION { Alpha = 255, Format = 1 };
                UpdateLayeredWindow(Handle, desktop, ref destination, ref size, memory, ref origin, 0, ref blend, 2);
                SetWindowPos(Handle, new IntPtr(-1), x, y, CardWidth, CardHeight, 0x10 | 0x40);
            }
            finally
            {
                SelectObject(memory, previous);
                DeleteObject(bitmap);
                DeleteDC(memory);
                ReleaseDC(IntPtr.Zero, desktop);
            }
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            timer.Stop(); timer.Dispose();
            if (mouseHook != IntPtr.Zero) UnhookWindowsHookEx(mouseHook);
            if (keyboardHook != IntPtr.Zero) UnhookWindowsHookEx(keyboardHook);
            pixels.Dispose(); frame.Dispose(); colorFont.Dispose(); labelFont.Dispose();
            base.OnFormClosed(e);
        }

        private delegate IntPtr HookCallback(int code, IntPtr message, IntPtr data);
        [StructLayout(LayoutKind.Sequential)] private struct POINT { public int X, Y; }
        [StructLayout(LayoutKind.Sequential)] private struct SIZE { public int Width, Height; }
        [StructLayout(LayoutKind.Sequential, Pack = 1)] private struct BLENDFUNCTION { public byte Operation, Flags, Alpha, Format; }
        [DllImport("user32.dll")] private static extern bool GetCursorPos(out POINT point);
        [DllImport("user32.dll")] private static extern bool SetWindowDisplayAffinity(IntPtr window, uint affinity);
        [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
        [DllImport("user32.dll")] private static extern IntPtr GetDC(IntPtr window);
        [DllImport("user32.dll")] private static extern int ReleaseDC(IntPtr window, IntPtr dc);
        [DllImport("gdi32.dll")] private static extern IntPtr CreateCompatibleDC(IntPtr dc);
        [DllImport("gdi32.dll")] private static extern bool DeleteDC(IntPtr dc);
        [DllImport("gdi32.dll")] private static extern IntPtr SelectObject(IntPtr dc, IntPtr value);
        [DllImport("gdi32.dll")] private static extern bool DeleteObject(IntPtr value);
        [DllImport("user32.dll")] private static extern bool UpdateLayeredWindow(IntPtr window, IntPtr desktop, ref POINT destination, ref SIZE size, IntPtr source, ref POINT origin, int key, ref BLENDFUNCTION blend, int flags);
        [DllImport("user32.dll")] private static extern IntPtr SetWindowsHookEx(int id, HookCallback callback, IntPtr module, uint thread);
        [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
        [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
        [DllImport("kernel32.dll", CharSet = CharSet.Auto)] private static extern IntPtr GetModuleHandle(string name);
    }
}
