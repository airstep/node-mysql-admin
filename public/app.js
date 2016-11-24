import m from 'mithril'
import Header from './component/header'
import IndexPage from './component/index-page'
import DbPage from './component/db-page'
import TablePage from './component/table-page'

window.onload = function () {

    // header
    m.render(document.querySelector("header"), <Header/>)

	// routes
    m.route.mode = "hash"
	m.route(document.querySelector("routes"), "/", {
    	"/": IndexPage,
    	"/db/:dbname": DbPage,
    	"/db/:dbname/:tablename": TablePage,
    	"/db/:dbname/:tablename/:page": TablePage
	})
	
}