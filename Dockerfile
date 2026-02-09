FROM emscripten/emsdk:3.1.51

WORKDIR /build

# Copy source files
COPY nbsdgames/ nbsdgames/
COPY wasm/curses.h wasm/curses.h
COPY wasm/term_input.js wasm/term_input.js
COPY build-wasm.sh build-wasm.sh

RUN chmod +x build-wasm.sh

# Output goes to /build/wasm/
CMD ["./build-wasm.sh"]
