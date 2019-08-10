import React from 'react';
import { Helmet } from 'react-helmet';
import { renderToString } from 'react-dom/server';

let assets: any;

const syncLoadAssets = () => {
    assets = require(process.env.RAZZLE_ASSETS_MANIFEST!);
};
syncLoadAssets();

export default function Html(root: React.ReactElement<any, any>) {
    const markup = renderToString(root);
    const { htmlAttributes, title, meta, link, bodyAttributes } = Helmet.renderStatic();
    return `<!doctype html>
    <html ${htmlAttributes.toString()}>
    <head>
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta charSet='utf-8' />
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${title.toString()}
        ${meta.toString()}
        ${assets.client.css ? `<link rel="stylesheet" href="${assets.client.css}">` : ''}
          ${
              process.env.NODE_ENV === 'production'
                  ? `<script src="${assets.client.js}" defer></script>`
                  : `<script src="${assets.client.js}" defer crossorigin></script>`
          }
          ${link.toString()}
    </head>
    <body ${bodyAttributes.toString()}>
        <div id="root">${markup}</div>
    </body>
</html>`;
}
