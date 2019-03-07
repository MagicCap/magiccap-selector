// This code is a part of MagicCap which is a MPL-2.0 licensed project.
// Copyright (C) Jake Gealer <jake@gealer.email> 2019.

#include <stdio.h>

#ifdef __WIN32
#include <Windows.h>
BOOL CALLBACK EnumWindowsProc(HWND hwnd, LPARAM _)
{
    if (IsWindowVisible(hwnd))
    {
        RECT WindowRect;
        GetWindowRect(hwnd, &WindowRect);
        printf("%lu %lu %lu %lu\n", WindowRect.left, WindowRect.top, WindowRect.right - WindowRect.left, WindowRect.bottom - WindowRect.top);
    }
    return true;
}

int main()
{
    EnumWindows(EnumWindowsProc, 0);
    return 0;
}
#elif __APPLE__
#include <ApplicationServices/ApplicationServices.h>
int main()
{
    CFArrayRef WindowList = CGWindowListCopyWindowInfo(kCGWindowListExcludeDesktopElements | kCGWindowListOptionOnScreenOnly | kCGWindowListOptionOnScreenAboveWindow, kCGNullWindowID);
    int ArrLength = CFArrayGetCount(WindowList);
    for(int i = 0; i < ArrLength; ++i) {
        CFDictionaryRef ProcessRef = (CFDictionaryRef)CFArrayGetValueAtIndex(WindowList, i);

        CGRect ItemBounds;
        CGRectMakeWithDictionaryRepresentation((CFDictionaryRef)CFDictionaryGetValue(ProcessRef, kCGWindowBounds), &ItemBounds);

        printf("%i %i %i %i\n", (int)ItemBounds.origin.x, (int)ItemBounds.origin.y, (int)ItemBounds.size.width, (int)ItemBounds.size.height);
    }
    return 0;
}
#else
int main()
{
    return 0;
}
#endif
