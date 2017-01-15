import React from 'react'
import {Link} from 'react-router'
import Tab from '../../../components/Tab'
import Tabs from '../../../components/Tabs'
import TableStructure from './tabs/structure/TableStructure'
import TableRows from './tabs/rows/TableRows'

/*
 * In this component, there are two components showing:
 * DatabaseTablePageColumns and DatabaseTablePageRows
 */

class DatabaseTablePage extends React.Component {

    constructor(props) {
        super(props)

        this.state = {}
    }

    render() {

        const self = this
        const props = self.props
        const dbname = props.params.dbname
        const tablename = props.params.tablename

        return (
            <div>

                <Tabs selected={0}>
                    <Tab label="Rows"><TableRows {...self.props.params}/></Tab>
                    <Tab label="Structure"><TableStructure {...self.props.params}/></Tab>
                </Tabs>

            </div>
        )
    }

}

export default DatabaseTablePage