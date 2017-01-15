import React from 'react'
import ReactDOM from 'react-dom'

import {Router, Route, IndexRoute} from 'react-router'
import CreateBrowserHistory from 'history/lib/createBrowserHistory'

import App from './App'
import HomePage from './pages/HomePage'
import DatabasePage from './pages/database/DatabasePage'
import TablePage from './pages/database/table/TablePage'

const routes =  (
    <Router history={CreateBrowserHistory()}>
        <Route path="/" component={App}>
            <IndexRoute component={HomePage} />
            <Route path="/" component={HomePage} />
            <Route path="/database/:dbname" component={DatabasePage} />
            <Route path="/database/:dbname/:tablename" component={TablePage} />
        </Route>
    </Router>
);

ReactDOM.render(routes, document.getElementById('app'));