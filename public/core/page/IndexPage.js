/** @jsx m */

import m from 'mithril'
import DbList from '../component/DbList'

export default  {

    view: function () {

        var self = this

        return (
            <div>
                <DbList/>
            </div>
        );
    }

}