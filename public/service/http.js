import m from 'mithril'
import auth from './auth'

function req(url, data, type) {

	if(!data) {
		data = {}
	}

	data["token"] = auth.isLogged()

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