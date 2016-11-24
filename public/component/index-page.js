import m from 'mithril' 
import http from '../service/http'

function controller() {

	var self = this
	self.databases = m.prop([])

	/* list databases */
	self.listDatabases = function () {
		http.post("/database/list", {}).then(function (r) {
			
			if(r.code == 404) {
				return alert(r.message)
			}

			self.databases = m.prop(r.payload) 
		})
	}

	self.listDatabases()

}

function view (ctrl) {
    return (
    	<div>
    		Index
    	</div>
    );
}

export default { view, controller }

