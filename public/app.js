import m from 'mithril'
import Header from './component/header'
import IndexPage from './component/index-page'
import DbPage from './component/db-page'
import TablePage from './component/table-page'
import DbList from './component/db-list'

window.onload = function () {

    // header
    m.render(document.querySelector("header"), <Header/>)

    // db list component
    m.module(document.querySelector("dblist"), <DbList/>)

	// routes
    m.route.mode = "hash"
	m.route(document.querySelector("routes"), "/", {
    	"/": IndexPage,
    	"/db/:dbname": DbPage,
    	"/db/:dbname/:tablename": TablePage,
    	"/db/:dbname/:tablename/:page": TablePage
	})
	
}