import React from 'react';
import { Route, Switch } from 'react-router-dom';
import Home from './Home';

import './App.css';
import Helmet from 'react-helmet';

const App = () => (
    <>
        <Helmet>
            <meta http-equiv="X-UA-Compatible" content="IE=edge" />
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Example React App</title>
        </Helmet>
        <Switch>
            <Route exact={true} path="/" component={Home} />
        </Switch>
    </>
);

export default App;
