import './style.css';
import { support } from './support';
import { renderUnsupported } from './unsupported';

// The app is loaded dynamically so that a browser missing the basics sees a clear message instead of a blank page.
if (!support.strip) renderUnsupported(document.getElementById('app')!, support);
else void import('./main');
