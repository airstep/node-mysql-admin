import m from 'mithril' 
import http from '../service/http'
import Alert from './alert'

function controller() {

	var self = this
	self.tables = m.prop([])
	self.dbname = m.route.param().dbname
	self.tablename = m.route.param().tablename
    self.message = "Rows in '" + self.tablename + "' listed below"

	/* list tables */
	self.listTables = function () {
		http.post("/table/column/list", {dbname: self.dbname, tablename: self.tablename}).then(function (r) {
			
			if(r.code == 404) {
				return alert(r.message)
			}

			self.tables = m.prop(r.payload) 
		})
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
                        <th>Column</th>
                        <th>Type</th>
                        <th>Null</th>
                        <th>Default</th>
                    </tr>
                </thead>

                <tbody>
    				
    				{
    					ctrl.tables().map(function (r) {
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
    );
}

export default { view, controller }

