
import React from 'react'
import Sidebar from './components/Sidebar'
import DatabaseBreadCrumb from './pages/DatabaseBreadCrumb'

class App extends React.Component {

    constructor(props) {
        super(props)
    }

    render() {

        return (
            <div className="container-fluid">
                <div className="row">

                    <Sidebar {...this.props.params}/>

                    <main className="col-md-10 offset-md-2" style={{marginTop: 10}}>
                        <DatabaseBreadCrumb {...this.props} />
                        {this.props.children}
                    </main>

                </div>
            </div>
        )
    }

}

export default App