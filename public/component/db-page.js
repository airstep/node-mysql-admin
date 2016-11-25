import m from 'mithril' 
import http from '../service/http'
import Alert from './alert'

function controller() {

	var self = this
	self.tables = m.prop([])
	self.dbname = m.route.param().dbname
    self.message = "Tables in '" + self.dbname + "' listed below"

	/* list tables */
	self.listTables = function () {
		http.post("/table/list", {dbname: self.dbname}).then(function (r) {
			
			if(r.code == 404) {
				return alert(r.message)
			}

			self.tables = m.prop(r.payload) 
		})
	}

    self.useTable = function (r) {
        m.route("/db/" + self.dbname + "/" + r)
    }

	self.listTables()
}

function view (ctrl) {

    return (
    	<div>

            <Alert message={ctrl.message}/>
    		
    		<table class="w3-table-all w3-hoverable">
    			 
                <thead>
                    <tr>
                        <th>Table name</th>
                        <th>Operations</th>
                    </tr>
                </thead>

                <tbody>
    				
    				{
    					ctrl.tables().map(function (r) {
    						return <tr>
    							<td 
                                onclick={ctrl.useTable.bind(this, r)} 
                                class="pointer">{r}</td>
                                <td>
                                    <span class="w3-text-teal pointer">empty</span> | <span class="w3-text-red pointer">drop</span>
                                </td>
							</tr>
    					})
    				}

    			</tbody>
    		</table>


            <div class="w3-panel w3-padding-8 w3-border">
                <h4>Operations</h4>

                <ul class="w3-ul">
                    <li class="pointer" style="margin-left:-16px;">
                        <i class="fa fa-remove w3-text-red"></i> Delete this database
                    </li>
                </ul>

            </div> 


    	</div>
    );
}

export default { view, controller }

