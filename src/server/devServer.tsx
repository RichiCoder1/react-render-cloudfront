import express from 'express';
import React from 'react';
import { StaticRouter } from 'react-router-dom';
import Html from './Html';

import App from '../App';

const server = express()
    .disable('x-powered-by')
    .use(express.static(process.env.RAZZLE_PUBLIC_DIR!))
    .get('/*', (req: express.Request, res: express.Response) => {
        const context = {};
        res.send(
            Html(
                <StaticRouter context={context} location={req.url}>
                    <App />
                </StaticRouter>
            )
        );
    });

export default server;
