import React from 'react'
import Http from '../services/Http'
import {Link} from 'react-router'

class Sidebar extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            databases: [],
            selectedDbname: null
        }
    }

    componentDidMount() {

        this.setState({
            selectedDbname: this.props.dbname,
            selectedTablename: this.props.tablename,
        })

        this.listDatabases()
    }

    componentWillReceiveProps(nextProps) {

        this.setState({
            selectedDbname: nextProps.dbname,
            selectedTablename: nextProps.tablename
        })

    }

    listDatabases() {

        let self = this

        Http.post("/database/list")
            .then(function (r) {

                if(r.data.code == 400) {
                    return
                }

                self.setState({
                    databases: r.data.payload
                })

            })
    }

    render() {

        const self = this
        const databases = self.state.databases
        const tables = self.state.tables

        return (
            <nav className="col-md-2 hidden-xs-down bg-faded sidebar">
                <ul className="nav nav-pills flex-column">

                    {
                        databases.map(function (item, idx) {
                            return (
                                <li
                                    key={idx}
                                    className="nav-item">
                                    <Link
                                        to={"/database/" + item.Database}
                                        className={"nav-link " + (item.Database == self.state.selectedDbname ? "active" : null)}>
                                        {item.Database}
                                    </Link>

                                </li>
                            )
                        })
                    }

                </ul>
            </nav>
        )
    }

}

export default Sidebar