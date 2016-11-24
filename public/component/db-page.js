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
    		
    		<table class="w3-table w3-striped w3-bordered w3-hoverable w3-card-12">
    			 
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
    							<td onclick={ctrl.useTable.bind(this, r)}>{r}</td>
                                <td>
                                    empty | drop
                                </td>
							</tr>
    					})
    				}

    			</tbody>
    		</table>

    	</div>
    );
}

export default { view, controller }

