import m from 'mithril' 
import http from '../service/http'
import Alert from './alert'
import TableRow from './table-row'


function controller() {

	var self = this
	self.columns = m.prop([])
	self.dbname = m.route.param().dbname
	self.tablename = m.route.param().tablename
	self.page = m.route.param().page || 1
    self.browseMessage = "Rows in '" + self.tablename + "' table listed below"

    self.limit = 10
    self.rows = m.prop([])

	/* list tables */
	self.listColumns = function () {
		http.post("/table/column/list", {dbname: self.dbname, tablename: self.tablename}).then(function (r) {
			
			if(r.code == 404) {
				return alert(r.message)
			}

			self.columns = m.prop(r.payload) 

			//after columns
			self.listRows(self.page)
		})
	}

	/* list rows */
	self.listRows = function (page) {
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

	self.goBack = function() {
		self.page = parseInt(self.page) - 1

		if(self.page < 1) {
			self.page = 1
		}

		m.route("/db/" + self.dbname + "/" + self.tablename + "/" + self.page)
	}

	self.goForward = function() {
		self.page = parseInt(self.page) + 1
		m.route("/db/" + self.dbname + "/" + self.tablename + "/" + self.page)
	}

	self.openedTab = ""
	self.openTab = function (tabName) {
	    self.openedTab = tabName
	}

	self.isOpened = function(tabName) {
		if(tabName === self.openedTab) {
			return "opened"
		} else {
			return "hide"
		}
	}

	self.onrowdblclick = function (row, field) {

		// set edit mode true to show input
		row._isEditing = true
	}

	self.openTab("Browse")
	self.listColumns()
}

function view (ctrl) {

    return (
    	<div>

    		<ul class="w3-navbar w3-border w3-light-grey w3-margin-top">
				<li><a href="javascript:void(0)" onclick={ctrl.openTab.bind(ctrl, 'Browse')}>Browse</a></li>
				<li><a href="javascript:void(0)" onclick={ctrl.openTab.bind(ctrl, 'Columns')}>Columns</a></li>
				<li><a href="javascript:void(0)" onclick={ctrl.openTab.bind(ctrl, 'Sql')}>SQL</a></li>
			</ul>

			<div class="tab" class={ctrl.isOpened("Browse")}>

				<Alert message={ctrl.browseMessage}/>

				<ul class="w3-pagination w3-border w3-round">
					<li><a href="javascript:void(0)" onclick={ctrl.goBack.bind(ctrl)}>&#10094;</a></li>
					<li><a href="javascript:void(0)" onclick={ctrl.goForward.bind(ctrl)}>&#10095;</a></li>
				</ul>
				
				<table class="w3-table-all">
	    			 
	                <thead>
	                	<tr>
	                    {
	                    	ctrl.columns().map(function (r) {
	    						return <th>{r.Field}</th>
	    					})
	                	}
	                	</tr>
	                </thead>

	                <tbody>
	    				
	    				{
	    					ctrl.rows().map(function (row) {
	    						return <tr> 
	    						{
	    							ctrl.columns().map(function (column) {
	    								return <TableRow row={row} column={column}/>
	    							})
								}
								</tr>
	    					})
	    				}

	    			</tbody>
	    		</table>


			</div>

			<div class="tab" class={ctrl.isOpened("Columns")}>
    		
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
	    					ctrl.columns().map(function (r) {
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

			<div class="tab" class={ctrl.isOpened("Sql")}>

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

export default { view, controller }

