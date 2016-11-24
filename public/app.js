import m from 'mithril'
import Header from './component/header'
import IndexPage from './component/index-page'

window.onload = function () {

    // header
    m.render(document.querySelector("header"), <Header/>)

	// routes
    m.route.mode = "hash"
	m.route(document.querySelector("routes"), "/", {
    	"/": IndexPage
	})

	
}