import React from 'react'
import Http from '../../services/Http'
import Util from '../../services/Util'
import {Link} from 'react-router'


/*
* List tables in this page for a selected dbname
*/

class DatabasePage extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            tables: []
        }
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
                                    <td>##</td>
                                </tr>
                            )
                        })
                    }
                    </tbody>
                </table>
            </div>
        )
    }

}

export default DatabasePage