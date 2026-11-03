// PROTOTYPE, throwaway. Run with: npm run proto:sound
import { mount } from "svelte";
import SoundPrototype from "./SoundPrototype.svelte";
import { wonkeySignalCheck } from "./signalCheck";

Object.assign(window, { wonkeySignalCheck });
mount(SoundPrototype, { target: document.getElementById("app")! });
