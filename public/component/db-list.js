import m from 'mithril' 
import http from '../service/http'
import Alert from './alert'

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

	self.useDb = function (r) {
		m.route("/db/" + r.Database)
	}

	self.listDatabases()

}

function view (ctrl) {

    return (
    	<div>

    		<Alert message="Databases listed below"/>
    		
    		<table class="w3-table-all w3-hoverable">
    			<tbody>
    				{
    					ctrl.databases().map(function (r) {
    						return <tr onclick={ctrl.useDb.bind(this, r)} class="pointer">
    							<td>{r.Database}</td>
							</tr>
    					})
    				}
    			</tbody>
    		</table>

    	</div>
    );
}

export default { view, controller }

