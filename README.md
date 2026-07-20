# InBridge

InBridge is a personal-first MCP App that turns model-requested choices into an inline ChatGPT UI and returns the confirmed structured result to the conversation.

The first milestone focuses on one reliable loop:

1. The model calls `render_interaction`.
2. ChatGPT renders a radio-choice UI.
3. The user confirms a selection.
4. The app updates model context and sends a follow-up message.
5. The model reads the selection and continues automatically.

The initial development specification is available in [`plan/interactive-chat-ui-bridge-development-spec.md`](plan/interactive-chat-ui-bridge-development-spec.md).

## Status

Phase 1 technical proof of concept is being prepared.
