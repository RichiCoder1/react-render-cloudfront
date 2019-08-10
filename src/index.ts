import { Application } from 'express';
let handler = null;

if (process.env.NODE_ENV === 'development') {
  const express: () => Application = require('express');

  // this require is necessary for server HMR to recover from error
  // tslint:disable-next-line:no-var-requires
  let app = require('./server/devServer').default;
  
  if (module.hot) {
    module.hot.accept('./server/devServer', () => {
      console.log('🔁  HMR Reloading `./server`...');
      try {
        app = require('./server/devServer').default;
      } catch (error) {
        console.error(error);
      }
    });
    console.info('✅  Server-side HMR Enabled!');
  }
  
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  
  handler = express()
    .use((req, res) => app.handle(req, res))
    .listen(port, (err: Error) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(`> Started on port ${port}`);
    });
} else {
  handler = require('./server/cloudfrontHandler').default;
}

export default handler;