import m from 'mithril'
import Header from './component/header'
import Index from './component/index'
import Login from './component/login'
import Register from './component/register'
import Exit from './component/exit'

window.onload = function () {

    // header
    m.render(document.querySelector("header"), <Header/>)

	// routes
    m.route.mode = "hash"
	m.route(document.querySelector("routes"), "/", {
    	"/": Index,
    	"/login": Login,
    	"/register": Register,
    	"/exit": Exit
	})

	
}