import m from 'mithril' 
import http from '../service/http'
import pubsub from '../service/pubsub'
import Alert from './alert'

function controller(attrs) {

	var self = this
	self.tables = m.prop([])
	self.selectedDbname = attrs.selectedDbname
	self.database = attrs.database
	self.parentCtrl = attrs.parentCtrl

	self.selectedTablename = null
	self.counter = 0

	/* list tables in dbname */
	self.listTablesInDbname = function () {

		self.counter = self.counter + 1

		console.log("db-list-row redrawing", self.counter)

		if(!self.selectedDbname) {
			return
		}

		http.post("/table/list", {dbname: self.selectedDbname}).then(function (r) {
			
			if(r.code == 404) {
				return alert(r.message)
			}

			self.tables = m.prop(r.payload) 
			self.selectedTable()
		})
	}

	self.selectedTable = function () {
		self.selectedTablename = m.route.param().tablename

		if(!self.selectedTablename) {
			return
		}
	}

	//if this db is selected, show table list
	if(self.selectedDbname == self.database.Database) {
		self.listTablesInDbname()
	}

	self.useTable = function (tablename) {
		 m.route("/db/" + self.selectedDbname + "/" + tablename)
	}

}

function view (ctrl) {

    return (
    	<tr 
		class={"pointer " + (ctrl.database.Database == ctrl.selectedDbname ? "w3-pale-yellow" : "")} 
		
		>
			<td>

				<div
					onclick={ctrl.parentCtrl.useDb.bind(ctrl, ctrl.database)} 
				>
					{ctrl.database.Database}
				</div>

				<div class="w3-padding-left">
					{
						ctrl.tables().map(function (tablename) {
							return <div 
							onclick={ctrl.useTable.bind(ctrl, tablename)}
							style="padding:3px;"
							class={(" ") + (tablename == ctrl.selectedTablename ? "w3-border" : "")} 
							> {tablename} 
							</div>
						})
					}
				</div>
			</td>
		</tr>
    );
}

export default { view, controller }

