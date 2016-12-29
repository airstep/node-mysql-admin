import m from 'mithril'
import IndexPage from './core/page/IndexPage'
import DatabasePage from './core/page/DatabasePage'

window.onload = function () {

    // routes
    m.route(document.querySelector("routes"), "/", {
        "/": IndexPage,
        "/db/:dbname": DatabasePage
    })

}