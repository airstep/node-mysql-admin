import React from 'react'
import Http from '../../services/Http'
import Util from '../../services/Util'
import {Link} from 'react-router'
import Button from '../../components/Button'


/*
* List tables in this page for a selected dbname
*/

class DatabasePage extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            tables: []
        }

        this.dropTable = this.dropTable.bind(this)
    }

    componentDidMount() {
        this.listTables(this.props.params.dbname)
    }


    componentWillReceiveProps(nextProps) {
        this.listTables(nextProps.params.dbname)
    }


    listTables(dbname) {

        const self = this

        Http.post("/table/list", {dbname: dbname})
            .then(function (r) {

                if(r.data.code == 400) {
                    return
                }

                self.setState({
                    tables: r.data.payload
                })
            })
    }

    dropTable(table) {

        const self = this
        const dbname = self.props.params.dbname

        Http.post("/table/drop", {dbname: dbname, tablename: table})
            .then(function (r) {

                if(r.data.code == 400) {
                    alert(r.data.message)
                } else {
                    alert(r.data.message)
                    self.listTables(self.props.params.dbname)
                }

            })
    }

    render() {

        const self = this
        const props = self.props
        const dbname = props.params.dbname /* from params because this component is a page */
        const tables = self.state.tables

        return (
            <div>

                <table className="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th>Table</th>
                            <th>Operations</th>
                        </tr>
                    </thead>
                    <tbody>
                    {
                        tables.map(function (table, idx) {
                            return (
                                <tr key={idx}>
                                    <td className="pointer">
                                        <Link to={"/database/" + dbname + "/" + table}>{table}</Link>
                                    </td>
                                    <td>
                                        <Button type="danger" small onClick={() => {self.dropTable(table)}}>drop</Button>
                                    </td>
                                </tr>
                            )
                        })
                    }
                    </tbody>
                </table>
                {tables.length == 0 ? <center>There is no table in <strong>{dbname}</strong></center> : null}
            </div>
        )
    }

}

export default DatabasePage