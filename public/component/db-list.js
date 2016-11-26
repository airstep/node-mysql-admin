import m from 'mithril' 
import http from '../service/http'
import pubsub from '../service/pubsub'
import Alert from './alert'
import Component from './component'
import DbListRow from './db-list-row'


export default class DbList extends Component {
	init() {

		var self = this
		self.databases = m.prop([])
		self.selectedDbname = null

		// reload db list with this event
		// this event triggered from db-page component in dropDatabase() function
		pubsub.on("db-list:reload", function () {
			// body...
			self.listDatabases()
		})

		self.listDatabases()
		self.selectedDb()
	}

	listDatabases () {

		var self = this

		http.post("/database/list", {}).then(function (r) {

			if(r.code == 404) {
				return alert(r.message)
			}

			self.databases = m.prop(r.payload) 
		})
	}

	useDb (database) {
		m.route("/db/" + database.Database)
		this.selectedDb()
	}

	selectedDb () {
		this.selectedDbname = m.route.param().dbname
	}

	view() {

		var self = this

		return (
	    	<div class="nowrap db-list">

	    		{Alert.component({message: "Databases listed below"})}

	    		<table class="w3-table-all w3-hoverable">
	    			<tbody>
	    				{
	    					self.databases().map(function (database) {
	    						return DbListRow.component({
	    							key: database, 
		    						database: database,
		    						selectedDbname: self.selectedDbname,
		    						parentCtrl: self
	    						})
	    					})
	    				}
	    			</tbody>
	    		</table>

	    	</div>
	    );
	}
}


