import m from 'mithril' 
import http from '../service/http'
import pubsub from '../service/pubsub'
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

    self.useTable = function (tablename) {
        m.route("/db/" + self.dbname + "/" + tablename)
    }

    self.dropDatabase = function () {

        if(!confirm("Delete database named '" + self.dbname + "'"))
            return
        
        http.post("/database/drop", {dbname: self.dbname}).then(function (r) {
            
            if(r.code == 404) {
                return alert(r.message)
            }


            m.route("/")
            pubsub.emit("db-list:reload")

        })
    }

     self.dropTable = function (tablename) {

        if(!confirm("Delete table named '" + tablename + "'"))
            return
        
        http.post("/table/drop", {dbname: self.dbname, tablename: tablename}).then(function (r) {
            
            if(r.code == 404) {
                return alert(r.message)
            }

            self.listTables()
             
        })
    }

    self.emptyTable = function (tablename) {

        if(!confirm("Empty table named '" + tablename + "'"))
            return
        
        http.post("/table/empty", {dbname: self.dbname, tablename: tablename}).then(function (r) {
            
            if(r.code == 404) {
                return alert(r.message)
            }

            self.listTables()
             
        })
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
    					ctrl.tables().map(function (tablename) {
    						return <tr>
    							<td 
                                onclick={ctrl.useTable.bind(ctrl, tablename)} 
                                class="pointer">{tablename}</td>
                                <td>
                                    <span 
                                    class="w3-text-teal pointer"
                                    onclick={ctrl.emptyTable.bind(ctrl, tablename)}
                                    > empty</span> | <span 
                                    class="w3-text-red pointer"
                                    onclick={ctrl.dropTable.bind(ctrl, tablename)}
                                    >
                                    drop
                                    </span>
                                </td>
							</tr>
    					})
    				}

    			</tbody>
    		</table>


            <div class="w3-panel w3-padding-8 w3-border">
                <h4>Operations</h4>

                <ul class="w3-ul">
                    <li 
                    class="pointer" 
                    style="margin-left:-16px;"
                    onclick={ctrl.dropDatabase.bind(ctrl)}
                    >
                        <i class="fa fa-remove w3-text-red"></i> Delete this database
                    </li>
                </ul>

            </div> 


    	</div>
    );
}

export default { view, controller }

