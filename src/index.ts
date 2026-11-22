// Load .env FIRST — before any other import reads process.env
import dotenv from 'dotenv';
dotenv.config();

import React from 'react';
import { render } from 'ink';
import AuthScreen from './ui/screens/AuthScreen.js';

render(React.createElement(AuthScreen));
