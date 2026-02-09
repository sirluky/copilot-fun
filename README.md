This is fresh repo, so you have to implement and decide everything, under this is your Goals. Write your final project as a dev.to markdown post with details. and built it.

I am trying to make wrapper around recent copilot cli tool: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/use-hooks

You know that feeling. Using TUI tools is great, but we often tend to switch back to browser when we finish our prompt. Most of the time is great to watch your virtual brain thinking and doing stuff, managing multiple agent sessions, and also approving. But you know, sometimes, we just like to VibeCode.

For that I decided to create wrapper around Copilot CLI, called Copilot Fun Mode.

And how I build it? Completely coded using Copilot CLI and combination of GPT-52 / Opus 4.6 models.

See it in action in this Asciinema/Youtube snippet:
HERE VIDEO.

And what game we gonna play?
We have multiple options, preferably turn based? We have Tic-tac-Toe, Go, Chess?
Pexeso? - let's see what you remember after giving your AGI next prompt :D.
For those games I decided to use existing ones. Find TUI games nodejs my AGI...

You are maybe asking, how this could work...
Agains its wrapper, wrapper around Copilot CLI + Copilot Hooks, so you can execute command after any action your agent does https://docs.github.com/en/copilot/how-tos/copilot-cli/use-hooks.

Ok so how we do this?
First make a plan.
Could we integrate it straight in to the TUI?
No, there are no hooks for that and currently it's not opensource (idk if Microsoft would happily upvote this project by being slightly toxic).

Ok, so i asked explore https://docs.github.com/en/copilot/how-tos/copilot-cli/ documentation. And we did found something! We can use github cli hooks.

But for the interface? We can't simply use copilot because we want to toggle between "gaming tui screen" and "copilot screen". Suggest best tool for that, I was thinking about tmux, but this is problematic because it's not platform agnostic (it does not run on windows). I would like something that would run in windows and would run in same process as TUI wrapper + auto switcher somehow.

For demo try to implement showing copilot "fullscreen" in tui without breaking and second screen that i will toggle by Ctrl-G where i will see HELLO THERE message, or bash.
