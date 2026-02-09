/*
 * Emscripten JS library for terminal input.
 * Provides em_getch() which reads a single keypress from Node.js stdin.
 * Works with ASYNCIFY to allow blocking reads from C.
 */
mergeInto(LibraryManager.library, {
  em_getch__async: true,
  em_getch: function(timeout_ms) {
    return Asyncify.handleAsync(function() {
      return new Promise(function(resolve) {
        // One-time setup: put stdin in raw mode
        if (!Module._stdinReady) {
          Module._stdinReady = true;
          Module._inputBuffer = [];
          if (process.stdin.isTTY && process.stdin.setRawMode) {
            process.stdin.setRawMode(true);
          }
          process.stdin.resume();
          // Continuously collect input into buffer
          process.stdin.on('data', function(data) {
            var bytes = Buffer.from(data);
            var parsed = Module._parseKeySeq(bytes);
            if (parsed !== null) {
              // Skip focus events (-2) and other discardable sequences
              if (parsed >= 0) Module._inputBuffer.push(parsed);
            } else {
              for (var i = 0; i < bytes.length; i++) {
                // Translate \r (13) to \n (10) — PTY raw mode sends CR
                Module._inputBuffer.push(bytes[i] === 13 ? 10 : bytes[i]);
              }
            }
            // Wake up any pending getch
            if (Module._getchResolve) {
              var fn = Module._getchResolve;
              Module._getchResolve = null;
              fn();
            }
          });
        }

        // If we have buffered input, return immediately
        if (Module._inputBuffer.length > 0) {
          resolve(Module._inputBuffer.shift());
          return;
        }

        // Wait for input or timeout
        var timer = null;

        function onInput() {
          if (timer) clearTimeout(timer);
          if (Module._inputBuffer.length > 0) {
            resolve(Module._inputBuffer.shift());
          } else {
            resolve(-1);
          }
        }

        Module._getchResolve = onInput;

        if (timeout_ms > 0) {
          timer = setTimeout(function() {
            Module._getchResolve = null;
            resolve(-1); // ERR / timeout
          }, timeout_ms);
        }
      });
    });
  },

  em_setup_term__deps: [],
  em_setup_term: function() {
    // Key sequence parser
    Module._parseKeySeq = function(buf) {
      if (buf.length === 1) return null; // single char, handle as raw byte

      // ESC [ sequences
      if (buf[0] === 0x1b && buf.length >= 3 && buf[1] === 0x5b) {
        switch (buf[2]) {
          case 0x41: return 0x103; // KEY_UP
          case 0x42: return 0x102; // KEY_DOWN
          case 0x44: return 0x104; // KEY_LEFT
          case 0x43: return 0x105; // KEY_RIGHT
        }
        // Page Up/Down: ESC [ 5 ~ / ESC [ 6 ~
        if (buf.length >= 4 && buf[3] === 0x7e) {
          if (buf[2] === 0x35) return 0x153; // KEY_PPAGE
          if (buf[2] === 0x36) return 0x152; // KEY_NPAGE
        }
        // Function keys: ESC [ 1 1 ~ through ESC [ 1 5 ~
        if (buf.length >= 5 && buf[2] === 0x31 && buf[4] === 0x7e) {
          if (buf[3] === 0x31) return 0x109 + 1; // F1
          if (buf[3] === 0x32) return 0x109 + 2; // F2
          if (buf[3] === 0x33) return 0x109 + 3; // F3
          if (buf[3] === 0x34) return 0x109 + 4; // F4
          if (buf[3] === 0x35) return 0x109 + 5; // F5
        }
        // Focus events: ESC [ I (focus in) / ESC [ O (focus out) — discard
        if (buf[2] === 0x49 || buf[2] === 0x4f) return -2;
      }
      // ESC O sequences (xterm style F1-F4)
      if (buf[0] === 0x1b && buf.length >= 3 && buf[1] === 0x4f) {
        switch(buf[2]) {
          case 0x50: return 0x109 + 1; // F1
          case 0x51: return 0x109 + 2; // F2
          case 0x52: return 0x109 + 3; // F3
          case 0x53: return 0x109 + 4; // F4
        }
      }

      return null; // unknown sequence — will be processed byte by byte
    };
  },
});
