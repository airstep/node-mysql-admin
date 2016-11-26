import m from 'mithril' 
import http from '../service/http'
import pubsub from '../service/pubsub'
import Alert from './alert'
import Component from './component'

export default class DbPage extends Component {

    init() {
        var self = this
        self.tables = m.prop([])
        self.dbname = m.route.param().dbname
        self.message = "Tables in '" + self.dbname + "' listed below"
        self.listTables()
    }

    listTables () {
        var self = this
        http.post("/table/list", {dbname: self.dbname}).then(function (r) {
            
            if(r.code == 404) {
                pubsub.emit("error:show", r.message)
                return
            }

            self.tables = m.prop(r.payload) 
        })
    }

    useTable (tablename) {
        m.route("/db/" + this.dbname + "/" + tablename)
    }

     dropDatabase () {

        if(!confirm("Delete database named '" + this.dbname + "'"))
            return
        
        http.post("/database/drop", {dbname: this.dbname}).then(function (r) {
            
            if(r.code == 404) {
                return pubsub.emit("error:show", r.message)
            }


            m.route("/")
            pubsub.emit("db-list:reload")

        })
    }

    dropTable (tablename) {

        var self = this

        if(!confirm("Delete table named '" + tablename + "'"))
            return
        
        http.post("/table/drop", {dbname: self.dbname, tablename: tablename}).then(function (r) {
            
            if(r.code == 404) {
                return pubsub.emit("error:show", r.message)
            }

            self.listTables()
             
        })
    }

    emptyTable (tablename) {

        var self = this

        if(!confirm("Empty table named '" + tablename + "'"))
            return
        
        http.post("/table/empty", {dbname: self.dbname, tablename: tablename}).then(function (r) {
            
            if(r.code == 404) {
                return pubsub.emit("error:show", r.message)
            }

            self.listTables()
             
        })
    }

    view() {

        var self = this

        return (
            <div>

                {Alert.component({message: self.message})}
                
                <table class="w3-table-all w3-hoverable">
                     
                    <thead>
                        <tr>
                            <th>Table name</th>
                            <th>Operations</th>
                        </tr>
                    </thead>

                    <tbody>
                        
                        {
                            self.tables().map(function (tablename) {
                                return <tr>
                                    <td 
                                    onclick={self.useTable.bind(self, tablename)} 
                                    class="pointer">{tablename}</td>
                                    <td>
                                        <span 
                                        class="w3-text-teal pointer"
                                        onclick={self.emptyTable.bind(self, tablename)}
                                        > empty</span> | <span 
                                        class="w3-text-red pointer"
                                        onclick={self.dropTable.bind(self, tablename)}
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
                        onclick={self.dropDatabase.bind(self)}
                        >
                            <i class="fa fa-remove w3-text-red"></i> Delete this database
                        </li>
                    </ul>

                </div> 


            </div>
        );
    }

}
