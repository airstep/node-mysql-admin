/** @jsx m */

import m from 'mithril'
import Http from '../service/Http'

export default  {

    databases: [],
    response: {},

    oncreate: function () {

        var self = this

        Http.post("/database/list", {}).then(function (r) {

            if(r.code == 200) {
                self.databases = r.payload
            } else {
                self.response = r
            }

        })
    },

    chooseDatabase: function (database) {
        m.route.set("/db/" + database)
    },

    view: function () {

        var self = this

        return (
            <div>

                <table className="w3-table-all w3-hoverable">

                    <thead>
                    <tr><th>Database name</th></tr>
                    </thead>

                    <tbody>

                        {
                            self.databases.map(function (database) {
                                return (
                                    <tr key={database.Database}>
                                        <td
                                            onclick={self.chooseDatabase.bind(self, database.Database)}
                                        >
                                            {database.Database}
                                        </td>
                                    </tr>
                                )
                            })
                        }

                    </tbody>

                </table>

            </div>
        );
    }

}