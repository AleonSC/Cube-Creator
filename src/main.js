import './styles.css';

// Feature modules register themselves into the registries on import.
import './shapes/index.js';
import './modifiers/index.js';
import './surface/index.js';
import './effects/index.js';
import './particles/index.js';
import './presets/index.js';
import './export/index.js';
import './sculpt/brushes.js';

import { App } from './app.js';

window.cubeCreator = new App(document.getElementById('app'));
