import m from 'mithril' 
import http from '../service/http'
import pubsub from '../service/pubsub'
import Component from './component'

export default class DbListRow extends Component {

	init() {
		var self = this
		self.tables = m.prop([])
		self.selectedDbname = this.props.selectedDbname
		self.database = this.props.database
		self.parentCtrl = this.props.parentCtrl

		self.selectedTablename = null
		self.counter = 0

		//if this db is selected, show table list
		if(self.selectedDbname == self.database.Database) {
			self.listTablesInDbname()
		}
	}

	useTable (tablename) {
		var self = this
		m.route("/db/" + self.selectedDbname + "/" + tablename)
	}

	selectedTable () {
		var self = this
		self.selectedTablename = m.route.param().tablename

		if(!self.selectedTablename) {
			return
		}
	}

	listTablesInDbname () {

		var self = this

		self.counter = self.counter + 1

		if(!self.selectedDbname) {
			return
		}

		http.post("/table/list", {dbname: self.selectedDbname}).then(function (r) {
			
			if(r.code == 404) {
				return pubsub.emit("error:show", r.message)
			}

			self.tables = m.prop(r.payload) 
			self.selectedTable()
		})
	}

	view() {

		var self = this

		return (
	    	<tr 
			class={"pointer " + (this.database.Database == this.selectedDbname ? "w3-pale-yellow" : "")} 
			>
				<td>

					<div
						onclick={this.parentCtrl.useDb.bind(this.parentCtrl, this.database)} 
					>
						{this.database.Database}
					</div>

					<div class="w3-padding-left">
						{
							this.tables().map(function (tablename) {
								return <div 
								onclick={self.useTable.bind(self, tablename)}
								style="padding:3px;"
								class={(tablename == self.selectedTablename ? "w3-border" : "")} 
								> {tablename} 
								</div>
							})
						}
					</div>
				</td>
			</tr>
	    );
	}
}
