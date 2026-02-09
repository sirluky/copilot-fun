/*
 * Minimal ncurses shim for Emscripten/WASM
 * Maps curses calls to ANSI escape codes for terminal output.
 * Uses Emscripten's ASYNCIFY for blocking getch().
 */
#ifndef CURSES_H_SHIM
#define CURSES_H_SHIM

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdbool.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

/* ── Types ──────────────────────────────────────────────────────────────── */
typedef unsigned long chtype;
typedef struct { int y, x; } WINDOW;
typedef struct {
    int id;
    int x, y, z;
    unsigned long bstate;
} MEVENT;

/* ── Global state ───────────────────────────────────────────────────────── */
static WINDOW _stdscr_val = {0, 0};
static WINDOW* stdscr = &_stdscr_val;

static int LINES = 24;
static int COLS = 80;
static int _cur_y = 0, _cur_x = 0;
static int _cursor_visible = 1;
static chtype _current_attrs = 0;
static bool _has_colors = true;
static int _halfdelay_val = 0;
static int _nodelay_val = 0;

/* Color pairs storage */
#define MAX_COLOR_PAIRS 64
static int _color_pairs[MAX_COLOR_PAIRS][2]; /* fg, bg */

/* ── Attribute flags ────────────────────────────────────────────────────── */
#define A_NORMAL     0x00000000UL
#define A_BOLD       0x00200000UL
#define A_STANDOUT   0x00010000UL
#define A_REVERSE    0x00040000UL
#define A_DIM        0x00100000UL
#define A_UNDERLINE  0x00020000UL
#define A_CHARTEXT   0x000000FFUL
#define A_ATTRIBUTES 0xFFFFFF00UL

/* ── Color constants ────────────────────────────────────────────────────── */
#define COLOR_BLACK   0
#define COLOR_RED     1
#define COLOR_GREEN   2
#define COLOR_YELLOW  3
#define COLOR_BLUE    4
#define COLOR_MAGENTA 5
#define COLOR_CYAN    6
#define COLOR_WHITE   7

#define COLOR_PAIR(n) ((chtype)(n) << 8)

/* ── ACS characters (use Unicode box drawing) ───────────────────────────── */
#define ACS_VLINE    ((chtype)'|')
#define ACS_HLINE    ((chtype)'-')
#define ACS_ULCORNER ((chtype)'+')
#define ACS_URCORNER ((chtype)'+')
#define ACS_LLCORNER ((chtype)'+')
#define ACS_LRCORNER ((chtype)'+')
#define ACS_PLUS     ((chtype)'+')
#define ACS_LTEE     ((chtype)'+')
#define ACS_RTEE     ((chtype)'+')
#define ACS_TTEE     ((chtype)'+')
#define ACS_BTEE     ((chtype)'+')
#define ACS_BLOCK    ((chtype)'#')

/* ── Key constants ──────────────────────────────────────────────────────── */
#define KEY_UP        0x103
#define KEY_DOWN      0x102
#define KEY_LEFT      0x104
#define KEY_RIGHT     0x105
#define KEY_ENTER     0x157
#define KEY_MOUSE     0x199
#define KEY_F(n)      (0x109 + (n))
#define KEY_PPAGE     0x153
#define KEY_NPAGE     0x152
#define ERR           (-1)

/* ── Mouse constants ────────────────────────────────────────────────────── */
#define ALL_MOUSE_EVENTS 0x1FFFFFFFUL
#define BUTTON1_CLICKED  0x04UL

/* ── Output helpers ─────────────────────────────────────────────────────── */
static void _emit(const char* s) {
    fputs(s, stdout);
}

static void _emit_move(int y, int x) {
    printf("\033[%d;%dH", y + 1, x + 1);
    _cur_y = y;
    _cur_x = x;
}

static void _apply_attrs(chtype attrs) {
    _emit("\033[0m"); /* reset first */

    /* Extract color pair number */
    int pair = (attrs >> 8) & 0xFF;
    if (pair > 0 && pair < MAX_COLOR_PAIRS) {
        int fg = _color_pairs[pair][0];
        int bg = _color_pairs[pair][1];
        if (fg >= 0) printf("\033[%dm", 30 + fg);
        if (bg >= 0) printf("\033[%dm", 40 + bg);
    }

    if (attrs & A_BOLD)      _emit("\033[1m");
    if (attrs & A_DIM)       _emit("\033[2m");
    if (attrs & A_UNDERLINE) _emit("\033[4m");
    if (attrs & A_REVERSE)   _emit("\033[7m");
    if (attrs & A_STANDOUT)  _emit("\033[7m"); /* reverse as standout */
}

/* ── Core curses functions ──────────────────────────────────────────────── */

/* Implemented in JavaScript, initializes key parser */
extern void em_setup_term(void);

static WINDOW* initscr(void) {
    /* Initialize terminal input handling */
    em_setup_term();

    /* Query terminal size via env or defaults */
    char* env_lines = getenv("LINES");
    char* env_cols = getenv("COLS");
    if (env_lines) LINES = atoi(env_lines);
    if (env_cols) COLS = atoi(env_cols);

    /* Enter alt screen buffer, clear, hide cursor */
    _emit("\033[?1049h");
    /* Disable focus reporting (prevents ^[[I / ^[[O artifacts) */
    _emit("\033[?1004l");
    _emit("\033[2J");
    _emit("\033[H");
    fflush(stdout);
    return stdscr;
}

static int endwin(void) {
    _emit("\033[0m");          /* reset attrs */
    _emit("\033[?25h");        /* show cursor */
    _emit("\033[?1049l");      /* leave alt screen */
    fflush(stdout);
    return 0;
}

static int noecho(void)   { return 0; }
static int cbreak(void)   { return 0; }
static int keypad(WINDOW* w, int bf) { (void)w; (void)bf; return 0; }
static bool has_colors(void) { return _has_colors; }
static int start_color(void) { return 0; }
static int use_default_colors(void) { return 0; }

static int init_pair(short pair, short fg, short bg) {
    if (pair >= 0 && pair < MAX_COLOR_PAIRS) {
        _color_pairs[pair][0] = fg;
        _color_pairs[pair][1] = bg;
    }
    return 0;
}

static int curs_set(int visibility) {
    int old = _cursor_visible;
    _cursor_visible = visibility;
    if (visibility == 0)
        _emit("\033[?25l");
    else
        _emit("\033[?25h");
    fflush(stdout);
    return old;
}

static int erase(void) {
    _emit("\033[2J\033[H");
    _cur_y = _cur_x = 0;
    fflush(stdout);
    return 0;
}

static int clear(void) {
    return erase();
}

static int refresh(void) {
    fflush(stdout);
    return 0;
}

static int move(int y, int x) {
    _emit_move(y, x);
    return 0;
}

static int attron(chtype attrs) {
    _current_attrs |= attrs;
    return 0;
}

static int attroff(chtype attrs) {
    _current_attrs &= ~attrs;
    return 0;
}

static int addch(chtype ch) {
    chtype attrs = _current_attrs | (ch & A_ATTRIBUTES);
    char c = (char)(ch & A_CHARTEXT);
    if (attrs & A_ATTRIBUTES) {
        _apply_attrs(attrs);
        putchar(c ? c : ' ');
        _emit("\033[0m");
        if (_current_attrs & A_ATTRIBUTES) _apply_attrs(_current_attrs);
    } else {
        putchar(c ? c : ' ');
    }
    _cur_x++;
    return 0;
}

static int mvaddch(int y, int x, chtype ch) {
    _emit_move(y, x);
    return addch(ch);
}

static int addstr(const char* str) {
    if (_current_attrs & A_ATTRIBUTES) _apply_attrs(_current_attrs);
    fputs(str, stdout);
    if (_current_attrs & A_ATTRIBUTES) _emit("\033[0m");
    _cur_x += strlen(str);
    return 0;
}

static int mvaddstr(int y, int x, const char* str) {
    _emit_move(y, x);
    return addstr(str);
}

static int printw(const char* fmt, ...) {
    if (_current_attrs & A_ATTRIBUTES) _apply_attrs(_current_attrs);
    va_list args;
    va_start(args, fmt);
    vprintf(fmt, args);
    va_end(args);
    if (_current_attrs & A_ATTRIBUTES) _emit("\033[0m");
    fflush(stdout);
    return 0;
}

static int mvprintw(int y, int x, const char* fmt, ...) {
    _emit_move(y, x);
    if (_current_attrs & A_ATTRIBUTES) _apply_attrs(_current_attrs);
    va_list args;
    va_start(args, fmt);
    vprintf(fmt, args);
    va_end(args);
    if (_current_attrs & A_ATTRIBUTES) _emit("\033[0m");
    fflush(stdout);
    return 0;
}

static int ungetch(int ch) {
    return ungetc(ch, stdin);
}

static int beep(void) {
    _emit("\007");
    fflush(stdout);
    return 0;
}

static int halfdelay(int tenths) {
    _halfdelay_val = tenths;
    return 0;
}

static int nodelay(WINDOW* w, int bf) {
    (void)w;
    _nodelay_val = bf;
    return 0;
}

static int napms(int ms) {
#ifdef __EMSCRIPTEN__
    emscripten_sleep(ms);
#endif
    return 0;
}

/* ── Mouse (stub — no real mouse in WASM terminal) ──────────────────────── */
static int mousemask(unsigned long mask, unsigned long* oldmask) {
    (void)mask; (void)oldmask;
    return 0;
}
static int getmouse(MEVENT* event) {
    (void)event;
    return -1; /* always fail, no mouse support */
}
static int nc_getmouse(MEVENT* event) {
    return getmouse(event);
}

/* ── Input (requires ASYNCIFY in Emscripten) ────────────────────────────── */

/* Implemented in JavaScript, injected via --js-library */
extern int em_getch(int timeout_ms);

static int getch(void) {
    int timeout = 0;
    if (_halfdelay_val > 0) {
        timeout = _halfdelay_val * 100; /* tenths of second to ms */
    } else if (_nodelay_val) {
        timeout = 1; /* non-blocking: 1ms timeout */
    }
    return em_getch(timeout);
}

static int wgetch(WINDOW* w) {
    (void)w;
    return getch();
}

/* ── Additional functions needed by games ───────────────────────────────── */
static int flushinp(void) {
    return 0; /* stub — flush input buffer */
}

static int nocbreak(void) {
    return 0; /* stub */
}

static int mvhline(int y, int x, chtype ch, int n) {
    _emit_move(y, x);
    char c = (char)(ch & A_CHARTEXT);
    if (!c) c = '-';
    for (int i = 0; i < n; i++) putchar(c);
    _cur_x += n;
    return 0;
}

static int mvvline(int y, int x, chtype ch, int n) {
    char c = (char)(ch & A_CHARTEXT);
    if (!c) c = '|';
    for (int i = 0; i < n; i++) {
        _emit_move(y + i, x);
        putchar(c);
    }
    return 0;
}

static int wnoutrefresh(WINDOW* w) {
    (void)w;
    fflush(stdout);
    return 0;
}

static int doupdate(void) {
    fflush(stdout);
    return 0;
}

#endif /* CURSES_H_SHIM */
