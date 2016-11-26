import m from 'mithril'
import pubsub from './pubsub'

function req(url, data, type) {

	if(!data) {
		data = {}
	}

	// show loading icon in header
	pubsub.emit("loading:show")

	var def = m.deferred()

	m.request({
		method: type,
		url: url,
		data: data
	}).then(function (r) {

		// hide loading icon in header
		pubsub.emit("loading:hide")

		def.resolve(r)
	})

	return def.promise

}
function post (url, data) {
	return req(url, data, "POST")
}

function get (url, data) {
	return req(url, data, "GET")
}

export default { post, get }