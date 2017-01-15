import React from 'react'
import Http from '../../../../../services/Http'
import {Link} from 'react-router'

/*
 * List structure in this component for a selected tablename
 */

class TableStructure extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            columns: []
        }
    }

    componentDidMount() {
        this.listColumns()
    }

    listColumns() {

        const self = this
        const dbname = self.props.dbname
        const tablename = self.props.tablename

        Http.post("/table/column/list", {dbname: dbname, tablename: tablename})
            .then(function (r) {

                if(r.data.code == 400) {
                    return
                }

                self.setState({
                    columns: r.data.payload
                })
            })
    }

    render() {

        const self = this
        const columns = self.state.columns

        return (
            <div>
                <table className="table table-sm table-hover table-striped">
                    <thead>
                    <tr>
                        <th>Column</th>
                        <th>Type</th>
                        <th>Null?</th>
                        <th>Default</th>
                        <th>Operations</th>
                    </tr>
                    </thead>
                    <tbody>
                    {
                        columns.map(function (col, idx) {
                            return (
                                <tr key={idx}>
                                    <td className="pointer">
                                        {(col.Key == "PRI") ? <span><i className="fa fa-key"></i>&nbsp;</span> : null}
                                        {col.Field}
                                    </td>
                                    <td className="pointer">{col.Type}</td>
                                    <td className="pointer">{col.Null}</td>
                                    <td className="pointer">{col.Default}</td>
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

export default TableStructure