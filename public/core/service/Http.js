import m from 'mithril'

function req(url, data, type) {

    if(!data) {
        data = {}
    }

    return m.request({
        method: type,
        url: url,
        data: data
    })
}

function post (url, data) {
    return req(url, data, "POST")
}

function get (url, data) {
    return req(url, data, "GET")
}

export default { post, get }