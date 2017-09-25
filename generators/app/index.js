const util = require('util');
const chalk = require('chalk');
const generator = require('yeoman-generator');
const packagejs = require('../../package.json');
const semver = require('semver');
const BaseGenerator = require('generator-jhipster/generators/generator-base');
const jhipsterConstants = require('generator-jhipster/generators/generator-constants');
const jhipsterUtils = require('generator-jhipster/generators/utils');

const _ = require('lodash');
const pluralize = require('pluralize');

const JhipsterGenerator = generator.extend({});
util.inherits(JhipsterGenerator, BaseGenerator);

module.exports = JhipsterGenerator.extend({
    initializing: {
        readConfig() {
            this.jhipsterAppConfig = this.getJhipsterAppConfig();
            if (!this.jhipsterAppConfig) {
                this.error('Can\'t read .yo-rc.json');
            }
        },
        displayLogo() {
            // it's here to show that you can use functions from generator-jhipster
            // this function is in: generator-jhipster/generators/generator-base.js
            this.printJHipsterLogo();

            // Have Yeoman greet the user.
            this.log(`\nWelcome to the ${chalk.bold.yellow('JHipster multitenancy')} generator! ${chalk.yellow(`v${packagejs.version}\n`)}`);
        },
        checkJhipster() {
            const jhipsterVersion = this.jhipsterAppConfig.jhipsterVersion;
            const minimumJhipsterVersion = packagejs.dependencies['generator-jhipster'];
            if (!semver.satisfies(jhipsterVersion, minimumJhipsterVersion)) {
                this.warning(`\nYour generated project used an old JHipster version (${jhipsterVersion})... you need at least (${minimumJhipsterVersion})\n`);
            }
        }
    },

    prompting() {
        const prompts = [
            {
                name: 'tenantName',
                message: 'What is the alias given tenants in your application?',
                default: 'Company',
                validate: function (input) {
                    if (_.toLower(input) === "account") {
                        return input + " is a reserved word.";
                    }
                    return true;
                }
            }
        ];

        const done = this.async();
        this.prompt(prompts).then((props) => {
            this.props = props;
            // To access props later use this.props.someOption;

            done();
        });
    },

    writing() {
        // function to use directly template
        this.template = function (source, destination) {
            this.fs.copyTpl(
                this.templatePath(source),
                this.destinationPath(destination),
                this
            );
        };

        // this.configOptions = this.options.configOptions || {};
        // this.databaseType = this.getDBTypeFromDBValue(this.options.db) || this.configOptions.databaseType || this.config.get('databaseType');

        // read config from .yo-rc.json
        this.baseName = _.upperFirst(this.jhipsterAppConfig.baseName);
        this.packageName = this.jhipsterAppConfig.packageName;
        this.packageFolder = this.jhipsterAppConfig.packageFolder;
        this.clientFramework = this.jhipsterAppConfig.clientFramework;
        this.clientPackageManager = this.jhipsterAppConfig.clientPackageManager;
        this.buildTool = this.jhipsterAppConfig.buildTool;
        this.jhiPrefix = this.jhipsterAppConfig.jhiPrefix;
        this.authenticationType = this.jhipsterAppConfig.authenticationType;
        this.databaseType = this.jhipsterAppConfig.databaseType;
        this.enableTranslation = this.jhipsterAppConfig.enableTranslation;

        // use function in generator-base.js from generator-jhipster
        this.angularAppName = this.getAngularAppName();

        // use constants from generator-constants.js
        const javaDir = `${jhipsterConstants.SERVER_MAIN_SRC_DIR + this.packageFolder}/`;
        const resourceDir = jhipsterConstants.SERVER_MAIN_RES_DIR;
        const webappDir = jhipsterConstants.CLIENT_MAIN_SRC_DIR;
        const testDir = jhipsterConstants.SERVER_TEST_SRC_DIR + this.packageFolder;
        
        /* tenant variables */
        this.tenantName = _.camelCase(this.props.tenantName);
        this.tenantNameUpperCase = _.toUpper(this.tenantName);
        this.tenantNameLowerCase = _.toLower(this.tenantName);
        this.tenantNameLowerFirst = _.lowerFirst(this.tenantName);
        this.tenantNameUpperFirst = _.upperFirst(this.tenantName);
        this.tenantNameSpinalCased = _.kebabCase(this.tenantNameLowerFirst);
        this.tenantNamePluralLowerFirst = pluralize(this.tenantNameLowerFirst);
        this.tenantNamePluralUpperFirst = pluralize(this.tenantNameUpperFirst);

        // copy .json entity file to project
        this.copy('.jhipster/_Tenant.json', `.jhipster/${this.tenantNameUpperFirst}.json`);
        this.tenantJson = this.getEntityJson(this.tenantNameUpperFirst);
        // overwrite the placeholder text with the alias set by user
        this.tenantJson.relationships[0].otherEntityRelationshipName = this.tenantNameLowerFirst;
        this.tenantJson.relationships[1].relationshipName = this.tenantNameLowerFirst+"Contact";
        this.tenantJson.entityTableName = this.tenantNameLowerFirst;
        // rewrite the json config file for the tenant
        this.fs.writeJSON(`.jhipster/${this.tenantNameUpperFirst}.json`, this.tenantJson, null, 4);

        // update user object and associated tests
        this.template('src/main/java/package/service/dto/UserDTO.java', `${javaDir}service/dto/UserDTO.java`);
        this.template('src/main/java/package/web/vm/ManagedUserVM.java', `${javaDir}web/rest/vm/ManagedUserVM.java`);
        
        // update create and update methods in user service to take into account the tenant
        this.createOld =  "    public User createUser(UserDTO userDTO) {\n        User user = new User();";
        this.createNew =  "    public User createUser(UserDTO userDTO) {\n"+
           "\t\tUser user = new User();\n"+
           "\t\tuser.set"+this.tenantNameUpperFirst+"(userDTO.get"+this.tenantNameUpperFirst+"());";
        this.replaceContent(`${javaDir}service/UserService.java`,this.createOld,this.createNew,false);

        this.updateOld = "    public Optional<UserDTO> updateUser(UserDTO userDTO) {\n"+
            "        return Optional.of(userRepository\n"+
                "            .findOne(userDTO.getId()))\n"+
                "            .map(user -> {\n"+
                "                user.setLogin(userDTO.getLogin());";
        this.updateNew = "\tpublic Optional<UserDTO> updateUser(UserDTO userDTO) {\n"+
            "\t\treturn Optional.of(userRepository\n"+
                "\t\t\t.findOne(userDTO.getId()))\n"+
                "\t\t\t.map(user -> {\n"+
                    "\t\t\t\tuser.setLogin(userDTO.getLogin());\n"+
                    "\t\t\t\tuser.set"+this.tenantNameUpperFirst+"(userDTO.get"+this.tenantNameUpperFirst+"());";
        this.replaceContent(`${javaDir}service/UserService.java`,this.updateOld,this.updateNew,false);
        
        this.template('src/main/java/package/domain/User.java', `${javaDir}domain/User.java`);
        this.template('src/test/java/package/web/rest/UserResourceIntTest.java', `${testDir}/web/rest/UserResourceIntTest.java`);
        this.template('src/test/java/package/web/rest/AccountResourceIntTest.java', `${testDir}/web/rest/AccountResourceIntTest.java`);
           
        this.changelogDate = this.dateFormatForLiquibase();
        this.template('src/main/resources/config/liquibase/changelog/_user_tenant_constraints.xml', `${resourceDir}config/liquibase/changelog/${this.changelogDate}__user_${this.tenantNameUpperFirst}_constraints.xml`);
        this.template('src/main/resources/config/liquibase/authorities.csv', `${resourceDir}config/liquibase/authorities.csv`);
        this.addChangelogToLiquibase(`${this.changelogDate}__user_${this.tenantNameUpperFirst}_constraints`);

        // copy over aspect
        this.template('src/main/java/package/aop/_tenant/_TenantAspect.java', `${javaDir}aop/${this.tenantNameLowerFirst}/${this.tenantNameUpperFirst}Aspect.java`);

        //user management UI
        this.rewriteFile(`${webappDir}app/admin/user-management/user-management-detail.component.html`,
                         '<dt><span jhiTranslate="userManagement.createdBy">Created By</span></dt>',
                         `<dt><span jhiTranslate="userManagement${this.tenantNameUpperFirst}">${this.tenantNameUpperFirst}</span></dt>
        <dd>{{user.${this.tenantNameLowerFirst}?.name}}</dd>`);

        this.rewriteFile(`${webappDir}app/admin/user-management/user-management-dialog.component.html`,
                         '<div class="form-group" *ngIf="languages && languages.length > 0">',
                         `<div class="form-group" *ngIf="${this.tenantNamePluralLowerFirst} && ${this.tenantNamePluralLowerFirst}.length > 0">
            <label jhiTranslate="userManagement${this.tenantNameUpperFirst}">${this.tenantNameUpperFirst}</label>
            <select class="form-control" id="${this.tenantNameLowerFirst}" name="${this.tenantNameLowerFirst}" [(ngModel)]="user.${this.tenantNameLowerFirst}" (change)="on${this.tenantNameUpperFirst}Change()">
                <option [ngValue]="null"></option> 
                <option [ngValue]="${this.tenantNameLowerFirst}.id === user.${this.tenantNameLowerFirst}?.id ? user.${this.tenantNameLowerFirst} : ${this.tenantNameLowerFirst}" *ngFor="let ${this.tenantNameLowerFirst} of ${this.tenantNamePluralLowerFirst}">{{${this.tenantNameLowerFirst}.name}}</option>
            </select>
        </div>`);

        this.template('src/main/webapp/user-management/_user-management-dialog.component.ts', `${webappDir}app/admin/user-management/user-management-dialog.component.ts`);        
        this.template('src/main/webapp/user-management/_user-management.component.html', `${webappDir}app/admin/user-management/user-management.component.html`);     
        this.template('src/main/webapp/user-management/_user.model.ts', `${webappDir}app/shared/user/user.model.ts`);        

        this.addTranslationKeyToAllLanguages(`userManagement${this.tenantNameUpperFirst}`,`${this.tenantNameUpperFirst}`,'addGlobalTranslationKey', this.enableTranslation);

        
        try {
            this.registerModule('generator-jhipster-multitenancy', 'entity', 'post', 'entity', '');
        } catch (err) {
            this.log(`${chalk.red.bold('WARN!')} Could not register as a jhipster entity post creation hook...\n`);
        }

        // company-management
        this.template('src/main/webapp/company-management/_company-management-delete-dialog.component.html', `${webappDir}app/admin/${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management-delete-dialog.component.html`);
        this.template('src/main/webapp/company-management/_company-management-delete-dialog.component.ts', `${webappDir}app/admin/${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management-delete-dialog.component.ts`);
        this.template('src/main/webapp/company-management/_company-management-detail.component.html', `${webappDir}app/admin/${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management-detail.component.html`);
        this.template('src/main/webapp/company-management/_company-management-detail.component.ts', `${webappDir}app/admin/${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management-detail.component.ts`);
        this.template('src/main/webapp/company-management/_company-management-dialog.component.html', `${webappDir}app/admin/${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management-dialog.component.html`);
        this.template('src/main/webapp/company-management/_company-management-dialog.component.ts', `${webappDir}app/admin/${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management-dialog.component.ts`);
        this.template('src/main/webapp/company-management/_company-management.component.html', `${webappDir}app/admin/${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management.component.html`);
        this.template('src/main/webapp/company-management/_company-management.component.ts', `${webappDir}app/admin/${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management.component.ts`);
        this.template('src/main/webapp/company-management/_company-management.route.ts', `${webappDir}app/admin/${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management.route.ts`);
        this.template('src/main/webapp/company-management/_company-modal.service.ts', `${webappDir}app/admin/${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-modal.service.ts`);
        this.template('src/main/webapp/company-management/_company.service.ts', `${webappDir}app/admin/${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}.service.ts`);
        this.template('src/main/webapp/company-management/_company.model.ts', `${webappDir}app/admin/${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}.model.ts`);

        this.template('src/main/webapp/_admin.module.ts', `${webappDir}app/admin/admin.module.ts`);
        
        this.template('src/main/webapp/_admin.route.ts', `${webappDir}app/admin/admin.route.ts`);
        this.template('src/main/webapp/company-management/_company-route-access-service.ts', `${webappDir}app/shared/auth/${this.tenantNameLowerFirst}-route-access-service.ts`);
        
        this.rewriteFile(`${webappDir}app/admin/index.ts`, 
            `export * from './admin.route';`, 
        `export * from './${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management.component';
        export * from './${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management-detail.component';
        export * from './${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management-dialog.component';
        export * from './${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management-delete-dialog.component';
        export * from './${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-modal.service';
        export * from './${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-management.route';
        export * from './${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}.service';
        export * from './${this.tenantNameLowerFirst}-management/${this.tenantNameLowerFirst}-modal.service';`);

        this.rewriteFile(`${webappDir}app/layouts/navbar/navbar.component.html`, 
            `<li *ngIf="!inProduction">`, 
            `<li [hidden]="has${this.tenantNameUpperFirst}()">
            <a class="dropdown-item" routerLink="${this.tenantNameLowerFirst}-management" routerLinkActive="active" (click)="collapseNavbar()"> 
                <span jhiTranslate="global.menu.admin.${this.tenantNameLowerFirst}Management">${this.tenantNamePluralUpperFirst} Management</span> 
            </a> 
        </li> `);

        this.rewriteFile(`${webappDir}app/layouts/navbar/navbar.component.ts`,
                        `getImageUrl() {`,
                        `has${this.tenantNameUpperFirst}() {
            return this.principal.get${this.tenantNameUpperFirst}() ? true : false;
        }`);

        this.rewriteFile(`${webappDir}app/shared/auth/principal.service.ts`,
                        `getImageUrl(): String {`,
                        `get${this.tenantNameUpperFirst}(): String {
        return this.isIdentityResolved() ? this.userIdentity.${this.tenantNameLowerFirst} : null;
    }\n`);

        this.template('src/main/webapp/company-management/_company-management.json', `${webappDir}i18n/en/${this.tenantNameLowerFirst}-management.json`);

        jhipsterUtils.rewriteJSONFile(`${webappDir}i18n/en/global.json`, (jsonObj) => { 
                jsonObj.global.menu.admin[`${this.tenantNameLowerFirst}Management`] = `${this.tenantNamePluralUpperFirst} Management`; 
            }, this);

        this.replaceContent(`${webappDir}app/app.module.ts`, `UserRouteAccessService } from './shared';`, `UserRouteAccessService, ${this.tenantNameUpperFirst}RouteAccessService } from './shared';`, 'false');
        this.rewriteFile(`${webappDir}app/app.module.ts`,`customHttpProvider(),`,`${this.tenantNameUpperFirst}RouteAccessService,`);

        this.rewriteFile(`${webappDir}app/shared/index.ts`,`export * from './auth/user-route-access-service';`,`export * from './auth/${this.tenantNameLowerFirst}-route-access-service';`);

    },
    install() {
        this.config.set('tenantName', this.tenantName);        
        this.composeWith('jhipster:entity', {
            regenerate: true,
            'skip-install': true,
            'skip-client': true,
            'skip-server': false,
            'no-fluent-methods': false,
            'skip-user-management': false,
            arguments: [this.tenantName],
        });

        let logMsg =
            `To install your dependencies manually, run: ${chalk.yellow.bold(`${this.clientPackageManager} install`)}`;

        if (this.clientFramework === 'angular1') {
            logMsg =
                `To install your dependencies manually, run: ${chalk.yellow.bold(`${this.clientPackageManager} install & bower install`)}`;
        }
        const injectDependenciesAndConstants = (err) => {
            if (err) {
                this.warning('Install of dependencies failed!');
                this.log(logMsg);
            } else if (this.clientFramework === 'angular1') {
                this.spawnCommand('gulp', ['install']);
            }
        };
        const installConfig = {
            bower: this.clientFramework === 'angular1',
            npm: this.clientPackageManager !== 'yarn',
            yarn: this.clientPackageManager === 'yarn',
            callback: injectDependenciesAndConstants
        };
        if (this.options['skip-install']) {
            this.log(logMsg);
        } else {
            this.installDependencies(installConfig);
        }
    },

    end() {
        this.log('End of multitenancy generator');
    }
});
