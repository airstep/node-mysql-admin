import m from 'mithril'
import Header from './component/header'
import IndexPage from './component/index-page'
import DbPage from './component/db-page'
import TablePage from './component/table-page'
import DbList from './component/db-list'

window.onload = function () {

	// routes
    m.route.mode = "hash"
	m.route(document.querySelector("routes"), "/", {
    	"/": IndexPage.component(),
    	"/db/:dbname": DbPage.component(),
    	"/db/:dbname/:tablename": TablePage.component(),
    	"/db/:dbname/:tablename/:page": TablePage.component()
	})

    // db list component
    // render after route staff
    m.module(document.querySelector("dblist"), DbList.component())

    // header
    m.module(document.querySelector("header"), Header.component())
	
}