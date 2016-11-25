import m from 'mithril' 
import http from '../service/http'
import pubsub from '../service/pubsub'
import Alert from './alert'
import DbListRow from './db-list-row'

function controller() {

	var self = this
	self.databases = m.prop([])
	self.selectedDbname = null

	/* list databases */
	self.listDatabases = function () {

		console.log("dblist", "listDatabases")

		http.post("/database/list", {}).then(function (r) {

			if(r.code == 404) {
				return alert(r.message)
			}

			self.databases = m.prop(r.payload) 
		})
	}

	self.useDb = function (r) {
		m.route("/db/" + r.Database)
		self.selectedDb()
	}

	self.selectedDb = function () {
		self.selectedDbname = m.route.param().dbname
	}

	// reload db list with this event
	// this event triggered from db-page component in dropDatabase() function
	pubsub.on("db-list:reload", self.listDatabases)

	self.listDatabases()
	self.selectedDb()

}

function view (ctrl) {

    return (
    	<div class="nowrap">

    		<Alert message="Databases listed below"/>
    		
    		<table class="w3-table-all w3-hoverable">
    			<tbody>
    				{
    					ctrl.databases().map(function (database) {
    						return <DbListRow 
    						key={database.Database}
    						database={database} 
    						selectedDbname={ctrl.selectedDbname} 
    						parentCtrl={ctrl}
    						/>
    					})
    				}
    			</tbody>
    		</table>

    	</div>
    );
}

export default { view, controller }

