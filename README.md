# DRIVE AGENT — Strategy chats and resizable columns

Open `demo.html?workspace=chat` for the full Chat page. The homepage ENTER DEMO button still opens Accounting. This is a separate release; earlier published versions are unchanged.

There are 50 new Amazon strategy conversations, plus MAINCHAT and any conversations started from Accounting products. Names are uppercase without spaces, with an emoji in a small square tile. The selected row is white; other rows are black. Conversations are ordered by recent activity. An empty conversation opens with one silent greeting: “Hello, how are you? I am ready to assist you.”

Drag the thin edge of the chat list left or right to resize it. At the narrowest width it shows only icons. The conversation retains at least 160px on supported mobile widths. Accounting has the same edge when FREEZE is selected: it resizes the combined frozen image/name area while keeping product thumbnails intact. Width preferences survive reloads and adapt to the viewport. Both handles support arrow keys, Shift+Arrow, Home to reset, End to maximize, and double-click to reset.

The full Chat page has no conversation heading. Typed messages appear immediately in black bubbles, followed by a local demo reply. Every bubble has copy and read-aloud controls. Drafts and histories are separate for each conversation. The small popup remains voice-focused, with no typing field; its floating chat button stays visible and becomes X when open.

Microphone captures one spoken message. Live Voice alternates listening, transcription, a demo response and playback, then listens again. Quiet pauses retry with bounded backoff. Settings include voice, playback speed and automatic reading of voice replies. Typed replies do not speak automatically. Switching rooms, closing the popup, opening the main menu, hiding the page or encountering a permission/network error stops voice. Read-aloud buttons never start the microphone.

This is a local interaction preview, not a connected AI assistant. Browser speech APIs provide recognition and playback, subject to device support and microphone permission. Some browsers use their speech service to process audio. There is no audio upload endpoint, server API key or paid AI integration in this site.

Chat storage uses `driveagent:strategy-chats:v2`. If absent, the previous product-chat storage is read once as the migration source; that old key is never overwritten. Catalog rooms are seeded idempotently, and legacy product histories and drafts are retained. Chat widths and Accounting widths use separate preference keys.

The typing field uses a true 16px font, retains focus during send/copy/read actions, and is not recreated when messages render. Keyboard fitting uses VisualViewport, with no duplicate inset when the Chrome viewport controller already sizes the shell. Root scroll recovery waits for keyboard dismissal. These paths are covered by simulated viewport and focus tests; physical iPhone keyboard behavior still requires device verification.

Validation includes model and speech-controller unit tests, DOM integrations for typing/drafts/copy/viewport changes, and browser checks at 320px, 393px and desktop widths. Chat and Accounting drag controls are tested with actual pointer input, including Accounting scrolling and UNFREEZE. Recognition is tested with controlled events, not ambient microphone recording.

Run `npm test` for unit checks. Run all checks with `DOLCE_QA_JSDOM=/path/to/jsdom node --max-old-space-size=4096 --test tests/*.test.mjs tests/*.integration.mjs`. Publish the committed new release with `npm run publish`.

References: [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport), [WebKit keyboard offset issue](https://bugs.webkit.org/show_bug.cgi?id=311821), [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API).
