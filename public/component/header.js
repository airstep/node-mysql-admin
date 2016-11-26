import m from 'mithril'
import Component from './component'

export default class Header extends Component {

    init() {
        var self = this
        self.selectedDbname = m.route.param().dbname
        self.selectedTablename = m.route.param().tablename
    }

    view() {
        return (
            <div class="w3-margin-top">
                <ul class="w3-navbar w3-border w3-light-grey">
                    <li><a href="/#/">Server</a></li>
                </ul>
            </div>
        );
    }

}
