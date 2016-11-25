import m from 'mithril'

function controller() {

    var self = this
    self.selectedDbname = m.route.param().dbname
    self.selectedTablename = m.route.param().tablename

}

function view(ctrl) {

    return (
        <div class="w3-margin-top">
            <ul class="w3-navbar w3-border w3-light-grey">
                <li><a href="/#/">Server</a></li>

                {
                	
                }

            </ul>
        </div>
    );
}

export default { view, controller }