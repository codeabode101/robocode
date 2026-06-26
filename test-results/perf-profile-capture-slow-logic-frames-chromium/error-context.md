# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf-profile.spec.ts >> capture slow logic frames
- Location: tests/perf-profile.spec.ts:3:5

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e6]:
      - button "⚔️" [ref=e7]
      - button "👥" [ref=e8]
      - button "👤" [ref=e9]
      - button "⚙️" [ref=e10]
    - generic [ref=e11]: $0
    - generic [ref=e12]: 🟢 Live island • 1 player
    - generic [ref=e13]: 4fps | L:1.22ms R:3.84ms | draws=86 tris=2402 | maxR=14.2ms | renders=9
    - generic [ref=e15]:
      - heading "How to play" [level=2] [ref=e16]
      - generic [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]: Arrow Keys
          - generic [ref=e20]:
            - generic [ref=e22]: ↑
            - generic [ref=e24]: ←
            - generic [ref=e25]: ↓
            - generic [ref=e26]: →
        - generic [ref=e27]:
          - generic [ref=e28]: WASD
          - generic [ref=e29]:
            - generic [ref=e31]: W
            - generic [ref=e33]: A
            - generic [ref=e34]: S
            - generic [ref=e35]: D
      - generic [ref=e36]:
        - img [ref=e37]
        - paragraph [ref=e39]: Move your mouse to look around
      - button "Got it!" [active] [ref=e41]
  - alert [ref=e42]
  - generic [ref=e43]: label-build-20260510-0342 — 10:09:04 PM
```