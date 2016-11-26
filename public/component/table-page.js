import m from 'mithril' 
import http from '../service/http'
import Alert from './alert'
import TableBrowseRow from './table-browse-row'
import Component from './component'

export default class TablePage extends Component {

	init() {
		var self = this
		self.columns = m.prop([])
		self.dbname = m.route.param().dbname
		self.tablename = m.route.param().tablename
		self.page = m.route.param().page || 1
	    self.browseMessage = "Rows in '" + self.tablename + "' table listed below"

	    self.limit = 10
	    self.rows = m.prop([])

	    self.openedTab = ""

	    self.openTab("Browse")
		self.listColumns()
	}

	listColumns () {
		var self = this
		http.post("/table/column/list", {dbname: self.dbname, tablename: self.tablename}).then(function (r) {
			
			if(r.code == 404) {
				return alert(r.message)
			}

			self.columns = m.prop(r.payload) 

			//after columns
			self.listRows(self.page)
		})
	}

	listRows (page) {

		var self = this

		http.post("/table/rows", {
			dbname: self.dbname, tablename: self.tablename,
			limit: self.limit, offset: (parseInt(self.page) - 1) * self.limit
		}).then(function (r) {
			
			if(r.code == 404) {
				return alert(r.message)
			}

			for (var j = 0; j < r.payload.length; j++) {
				
				var row = r.payload[j]

				// map row data to this obj using m.prop()
				var tempRowData = {}
					

				for (var i = 0; i < self.columns().length; i++) {
					
					var column = self.columns()[i]

					tempRowData[column.Field] = {}

					tempRowData[column.Field]["_isEditing"] = false
					tempRowData[column.Field]["data"] = m.prop(row[column.Field])
				}

				self.rows().push(tempRowData)
			}

		})
	}

	goBack () {
		var self = this
		self.page = parseInt(self.page) - 1

		if(self.page < 1) {
			self.page = 1
		}

		m.route("/db/" + self.dbname + "/" + self.tablename + "/" + self.page)
	}

	goForward () {
		var self = this
		self.page = parseInt(self.page) + 1
		m.route("/db/" + self.dbname + "/" + self.tablename + "/" + self.page)
	}

	openTab  (tabName) {
	    this.openedTab = tabName
	}

	isOpened (tabName) {
		if(tabName === this.openedTab) {
			return "opened"
		} else {
			return "hide"
		}
	}

	onrowdblclick (row, field) {

		// set edit mode true to show input
		row._isEditing = true
	}

	view () {

		var self = this

	    return (
	    	<div>

	    		<ul class="w3-navbar w3-border w3-light-grey w3-margin-top">
					<li><a href="javascript:void(0)" onclick={self.openTab.bind(self, 'Browse')}>Browse</a></li>
					<li><a href="javascript:void(0)" onclick={self.openTab.bind(self, 'Columns')}>Columns</a></li>
					<li><a href="javascript:void(0)" onclick={self.openTab.bind(self, 'Sql')}>SQL</a></li>
				</ul>

				<div class="tab" class={self.isOpened("Browse")}>

					{Alert.component({message: self.browseMessage})}

					<ul class="w3-pagination w3-border w3-round">
						<li><a href="javascript:void(0)" onclick={self.goBack.bind(self)}>&#10094;</a></li>
						<li><a href="javascript:void(0)" onclick={self.goForward.bind(self)}>&#10095;</a></li>
					</ul>
					
					<table class="w3-table-all">
		    			 
		                <thead>
		                	<tr>
		                    {
		                    	self.columns().map(function (r) {
		    						return <th>{r.Field}</th>
		    					})
		                	}
		                	</tr>
		                </thead>

		                <tbody>
		    				
		    				{
		    					self.rows().map(function (row) {
		    						return <tr> 
		    						{
		    							self.columns().map(function (column) {
		    								return TableBrowseRow.component({row:row, column:column})
		    							})
									}
									</tr>
		    					})
		    				}

		    			</tbody>
		    		</table>


				</div>

				<div class="tab" class={self.isOpened("Columns")}>
	    		
		    		<table class="w3-table-all w3-margin-top">
		    			 
		                <thead>
		                    <tr>
		                        <th>Column</th>
		                        <th>Type</th>
		                        <th>Null</th>
		                        <th>Default</th>
		                    </tr>
		                </thead>

		                <tbody>
		    				
		    				{
		    					self.columns().map(function (r) {
		    						return <tr>
		    							<td>{r.Field}</td>
		    							<td>{r.Type}</td>
		    							<td>{r.Null}</td>
		    							<td>{r.Default}</td>
									</tr>
		    					})
		    				}

		    			</tbody>
		    		</table>

				</div>

				<div class="tab" class={self.isOpened("Sql")}>

					<div class="w3-margin-top"></div>

					<textarea 
					class="w3-input w3-border"
					placeholder="Sql command"
					></textarea>

					<div class="w3-margin-top">

						<span class="w3-btn w3-green fl">Run</span>
						<span class="w3-btn w3-red fr">Clear</span>

					</div>
				</div>
	    	</div>
	    );
	}
}